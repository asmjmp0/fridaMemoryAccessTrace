var mem_berak_point={
    point:null, // NativePointer
    len:0,
    type:String(),
    enable:true,
    trace:false,
    page:Array() //内存保护的分页 4k对齐
}
var bkpt_bytecode=0xbebe
var bkpt_bytecode_arr=[0xbe,0xbe]
var _debug=false
var moto_code=null
var excp_pc_arr=new Array() //多线程访问处理

/**
 * 
 * @param {断点地址} point 
 * @param {断点长度} len 
 * @param {断点类型} type 
 * @param {是否启用断点} enable 
 * @param {是否开启trace} trace 
 */
function init_mem_break_point(point,len,type,enable,trace){
    mem_berak_point.point=point
    mem_berak_point.len=len
    mem_berak_point.type=type
    mem_berak_point.enable=enable
    mem_berak_point.trace=trace
}
function dbg_print(tag,parm){
    if(_debug) console.log("debug-"+tag,parm)
}
/**
 * 
 * @param {要设置的页面起始位置} _p 
 * @param {要设置的页面长度} _len 
 */
function get_page_setbreakpoint(_p,_len){
    if(_len>4096){
        console.log("breakpoint too big!!!")
        return null
    }
    var page1=_p.and(0xfffff000)
    var page2=_p.add(_len).and(0xfffff000)
    if(page1.equals(page2)){
        return [page1]
    }else return [page1,page2]
}
/**
 * 
 * @param {设置断点的分页表} array_p 
 */
function set_page_breakpoint(array_p){
    for (var i=0;i<array_p.length;i++) {
        Memory.protect(array_p[i],0x1000, '---')
    }
}

function resume_page_breakpoint(array_p){
    for (var i=0;i<array_p.length;i++) {
        Memory.protect(array_p[i],0x1000, 'rw-')
    }
}


function check_breakpoint_in_thispage(array_p,excpdata_addr){
    var temp_page=excpdata_addr.and(0xfffff000)
    dbg_print("excp page",temp_page)
    for(var i=0;i<array_p.length;i++){
        dbg_print("array_p",array_p[i])
        if(temp_page.equals(array_p[i])){
            return true
        } 
    }
    return false
}

/**
 * 必须在同一个分页中使用
 * 
 * @param {设置的断点地方} breakpoint_addr
 * @param {断点长度} b_len 
 * @param {现在命中的地方} excpdata_addr 
 */
function check_breakpoint_hit(breakpoint_addr,b_len,excpdata_addr){
    var _breakpoint_addr=breakpoint_addr.and(0xfff).toInt32()
    dbg_print("_breakpoint_addr",_breakpoint_addr)
    var _excpdata_addr=excpdata_addr.and(0xfff).toInt32()
    dbg_print("_excpdata_addr",_excpdata_addr)
    if(_excpdata_addr>= _breakpoint_addr
        && _excpdata_addr<=_breakpoint_addr+b_len)
        return true
    else return false

}

function set_bk_breakpoint(pc_addr){
    var ins =Instruction.parse(pc_addr.add(1))
    var size= ins["size"]
    dbg_print("ins size",size)
    Memory.protect(pc_addr,8, 'rwx')
    moto_code=pc_addr.add(size).readByteArray(2)
    if(Process.arch=="arm"){
        Memory.patchCode(pc_addr.add(size), 4, function (code) {
            var thumbwriter= new ThumbWriter(pc_addr.add(size))
            thumbwriter.putBytes(bkpt_bytecode_arr)
            thumbwriter.flush()
          });
    
    }else{
        console.log("arch not support")
    }
    Memory.protect(pc_addr,8, 'r-x')
    excp_pc_arr.push(pc_addr.add(size))
    
    dbg_print("set_bk_breakpoint",pc_addr.add(size))
}

function resume_bk_breakpoint(pc_addr){
    if(Process.arch=="arm"){
        Memory.patchCode(pc_addr, 4, function (code) {
            var thumbwriter= new ThumbWriter(pc_addr)
            thumbwriter.putBytes(moto_code)
            thumbwriter.flush()
          });
    
    }else{
        console.log("arch not support")
    }
    dbg_print("resume_bk_breakpoint",pc_addr)
}

function check_bk_breakpoint_hit(now_bk,b_arr){
    dbg_print("b_arr",b_arr)
    dbg_print("now_bk",now_bk)
    for(var i=0;i<b_arr.length;i++ ){
        if(now_bk.equals(b_arr[i])){
            b_arr.splice(i,1)
            return true
        }
    }

    return false
}

function print_r_value_from_context(r_json,context){
    var s=""
    for(var i=0;i<r_json.length;i++){
        var obj=r_json[i]
        if(obj["type"]=="reg"){
            s+=obj["value"]+": "+context[obj["value"]]+" "
        }
        if(obj["type"]=="mem"){
            s+=obj["value"]["base"]+": "+context[obj["value"]["base"]]+" "
        }
    }
    console.log("Register: "+s)
}

Process.setExceptionHandler(function (details){
    var error_type=details["type"];
    if(error_type=="access-violation"){ //触发了非法访问异常
        var data_address=details["memory"]["address"];
        var exception_pc=details["address"]

        if(check_breakpoint_in_thispage(mem_berak_point.page,data_address)){//是这个分页

            if(check_breakpoint_hit(mem_berak_point.point,mem_berak_point.len,data_address)){//命中目标
                console.log("\ntype: " + details["memory"]["operation"]);
                console.log("data target address: " + DebugSymbol.fromAddress(data_address));
                console.log("PC : " + DebugSymbol.fromAddress(exception_pc));
                var ins=Instruction.parse(exception_pc.add(1))//------ thumb
                console.log("ASM str:",ins.toString()) //打印当前指令
                print_r_value_from_context(ins["operands"],details["context"])
                set_bk_breakpoint(exception_pc)
                resume_page_breakpoint(mem_berak_point.page)
                console.log(data_address.toString()+":")
                console.log(data_address.readByteArray(mem_berak_point.len)) //打印触发异常地址内容
                return true
            }else{
                dbg_print("in this page but no hit",DebugSymbol.fromAddress(exception_pc))
                set_bk_breakpoint(exception_pc)
                resume_page_breakpoint(mem_berak_point.page)
                return true
            }

        }else{//不是这个分页
            dbg_print("no this page","past to process handle")
            return false //交给其他异常处理结构
        }
    }

    if(error_type=="breakpoint" && check_bk_breakpoint_hit(details["address"],excp_pc_arr)){ //触发断点
        var exception_pc=details["address"]
        //dbg_print("breakpoint","")
        dbg_print(exception_pc,"")
        resume_bk_breakpoint(exception_pc)
        set_page_breakpoint(mem_berak_point.page)
        return true
    }else{
        dbg_print("no this breakpoint","")
        return false //交给其他异常处理结构
    }

})

var op = recv('break_test', function(value) {
    var parm_get=value.payload
    var strs = parm_get.split(" ")
    if(strs.length!=2) console.log("bad parm")
    else{
        var __len=9//  修改长度。。。。

        if(strs[0]=="b"){
            var p=new NativePointer(ptr(strs[1]))
            console.log("\n"+p)
            init_mem_break_point(p,__len,"read",true,true)  //这个地方设置内存访问断点
            mem_berak_point.page=get_page_setbreakpoint(p,__len)
            set_page_breakpoint(mem_berak_point.page)
        } else if (strs[0]=="s"){
            var _strs = strs[1].split("!")
            if(_strs.length!=2) console.log("bad parm")
            else{
                var p=Module.findExportByName(_strs[0],_strs[1])
                console.log("\n"+p)
                init_mem_break_point(p,__len,"read",true,true)  //这个地方设置内存访问断点
                mem_berak_point.page=get_page_setbreakpoint(p,__len)
                set_page_breakpoint(mem_berak_point.page)
            }
        }else if(strs[0]=="o"){
            var _strs = strs[1].split("!")
            if(_strs.length!=2) console.log("bad parm")
            else{
                var m=Module.getBaseAddress(_strs[0])
                var p=m.add(ptr(_strs[1]))
                console.log("\n"+p)
                init_mem_break_point(p,__len,"read",true,true)  //这个地方设置内存访问断点
                mem_berak_point.page=get_page_setbreakpoint(p,__len)
                set_page_breakpoint(mem_berak_point.page)
            }
        }
}

});

