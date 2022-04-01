from cmath import pi
import frida
from rpcFunc import rpcFunc
import data_info as data
import argparse
import handle_exception
from handle_excepetion_info import exception_info


# python3 main.py -s libnative-lib.so@test_value -l 4
def test():
    print(data.break_point_info)


def wrapper_to_post(_type, content):
    return {'type': _type, 'payload': content}


def pointersize_pagesize_to_maskcode(pointer_size, page_size):
    pointer_mask = 'ff' * pointer_size
    page_size_len = 0
    while page_size != 1:
        page_size = page_size / 0x10
        page_size_len = page_size_len + 1
    pointer_mask_list = list(pointer_mask)
    pointer_mask_list[2 * pointer_size - page_size_len:] = '0' * page_size_len
    pointer_mask = ''.join(pointer_mask_list)
    return int(pointer_mask, 16)

# 对 data.soft_breakpoint_runtime中的数据进行检查
def find_soft_breakpoint_from_list(addr: int):
    with data.soft_breakpoint_runtime_lock:
        breakpoint_list_len = len(data.soft_breakpoint_runtime)
        if 0 != breakpoint_list_len:
            for index in range(0, breakpoint_list_len):
                if data.soft_breakpoint_runtime[index]['break_addr'] == addr:
                    return index
        return -1

def my_message_handler(message, payload):
    if message["type"] == "send":  # 接收
        messgae_data = message["payload"]

        if 'exception' == messgae_data['__tag']:
            handle_exception.handle(messgae_data)
        # 从js脚本那收到的设置软断点的信息，并把此保存到soft_breakpoint_runtime
        elif 'set_soft_breakpoint' == messgae_data['__tag']:
            addr = int(messgae_data['break_addr'], 16)
            index = find_soft_breakpoint_from_list(addr)
            #多线程访问
            if -1 != index:
                data.rpc.api._script.post(wrapper_to_post('set_soft_breakpoint_ret', 0))
                return
            else:
                save_soft_breakpoint = data.soft_breakpoint_struct.copy()
                save_soft_breakpoint['break_addr'] = int(messgae_data['break_addr'], 16)
                save_soft_breakpoint['break_len'] = messgae_data['break_len']
                save_soft_breakpoint['ins_content'] = messgae_data['ins_content']
            with data.soft_breakpoint_runtime_lock:
                pass
                # TODO
                data.soft_breakpoint_runtime.append(save_soft_breakpoint)
            data.rpc.api._script.post(wrapper_to_post('set_soft_breakpoint_ret', 0))
        elif 'resume_soft_breakpoint' == messgae_data['__tag']:
            addr = int(messgae_data['addr'],16)

            # 删除指定断点
            index = find_soft_breakpoint_from_list(addr)
            if -1 != index:
                with data.soft_breakpoint_runtime_lock:
                    pass
            else:
                raise Exception('soft_breakpoint no found')

            send_dict = {}
            send_dict['msg'] = 1
            data.rpc.api._script.post(wrapper_to_post('resume_soft_breakpoint_ret', send_dict))
        elif 'show_details' == messgae_data['__tag']:
            exception_info(messgae_data,data.proc_info['arch']).print_info()



def init_proc(js_file_name: str):
    process = frida.get_usb_device().attach(data.PACKAGE)
    js_file_content = open('index.js', 'r').read()
    script = process.create_script(js_file_content)
    script.on("message", my_message_handler)
    script.load()
    data.rpc = rpcFunc(script.exports)
    data.proc_info['arch'] = data.rpc.get_device_arch()
    data.proc_info['platform'] = data.rpc.get_platform()
    data.proc_info['pointersize'] = data.rpc.get_pointer_size()
    data.proc_info['pagesize'] = data.rpc.get_page_size()
    data.proc_info['mem_protect'] = data.rpc.get_protect_ranges()


def get_args():
    parse = argparse.ArgumentParser()
    group = parse.add_mutually_exclusive_group(required=True)

    parse.add_argument('-l', '--length', help='输入断点的长度最长不能超过pagesize', required=True, type=int)
    parse.add_argument('-n', '--name', help='输入程序包名', type=str)
    parse.add_argument('-lp','--listproc', help='展示进程',action='store_true')

    group.add_argument('-b', '--break', help='输入绝对地址，例如0x12345678', type=str)
    group.add_argument('-o', '--offset', help='输入相对地址，例如libxxx.so@0x1234', type=str)
    group.add_argument('-s', '--symbol', help='输入符号，例如libxxx.so@test_value', type=str)

    data.args = vars(parse.parse_args())
    if data.args['listproc']:
        lists = frida.get_usb_device().enumerate_processes()
        for item in lists:
            print(item)
        exit(0)
    if data.args['name']:
        data.PACKAGE = data.args['name']


def handle_breakinfo_args():
    args_list = ['break', 'offset', 'symbol']
    def wrapper_input_str(s: str, l: int, input_type: str):
        if l > data.proc_info['pagesize']:
            raise Exception('length must be less than %d' % (data.proc_info['pagesize']))

        data.break_point_info['break_len'] = l
        if 'break' == input_type:
            data.break_point_info['break_addr'] = int(s, 16)
        else:
            arr = s.split('@')
            if 2 != len(arr):
                raise Exception('wrapper_input_str input type error')
            if 'offset' == input_type:
                data.break_point_info['break_addr'] = int(data.rpc.get_module(arr[0]['base']), 16) + int(arr[1], 16)
            elif 'symbol' == input_type:
                data.break_point_info['break_addr'] = int(data.rpc.get_export_by_name(arr[0], arr[1]), 16)

    for key in args_list:
        if data.args[key]:
            wrapper_input_str(data.args[key], data.args['length'], key)


# 获取断点的信息
def get_breakinfo():
    ret_list = []
    for item in data.proc_info['mem_protect']:
        if data.break_point_info['break_addr'] + data.break_point_info['break_len'] in range(item['base'],item['base'] + item['size']):
            ret_list = [data.break_point_info['break_addr'] & pointersize_pagesize_to_maskcode(data.proc_info['pointersize'],data.proc_info['pagesize']),item['protection']]
            data.break_point_info['break_page_info'] = ret_list
            break

    if [] == ret_list:
        raise Exception('get_break_info the break pointer must be in a segement')


def remake_memprotect_info():
    for item in data.proc_info['mem_protect']:
        item['base'] = int(item['base'], 16)


def init_breakinfo():
    remake_memprotect_info()
    get_breakinfo()


def set_breakpoint():
    point = data.break_point_info['break_page_info']
    data.rpc.set_page_protect(point[0], '---')
    data.rpc.set_exception_handler()


def main():
    try:
        # 获取命令行参数
        get_args()
        # 初始化程序信息
        init_proc('index.js')
        # 处理从命令行参数中获取的信息
        handle_breakinfo_args()
        # 初始化断点信息
        init_breakinfo()
        # 设置断点
        set_breakpoint()
        test()
    except Exception as e:
        print('error:', e)


if __name__ == '__main__':
    main()
    input()
