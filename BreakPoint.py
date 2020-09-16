import frida
import sys
import os
import socket
#com.example.jnitest

PACKAGE = "com.example.jnitest"
scan=''
def my_message_handler(message, payload):
    if message["type"] == "send": #接收
        data=message["payload"]
if __name__ == '__main__':
    if sys.argv.__len__()==2:
        PACKAGE=sys.argv[1]
    jscode = open('MemoryBreakPoint.js', 'r').read()
    try:
        process = frida.get_usb_device().attach(PACKAGE)
    except:
        print('frida server 未启动.... ')
        exit
    print(process)
    script = process.create_script(jscode)
    script.on("message", my_message_handler) 
    script.load()
    print('run successfully')
    while scan!="exit":
        scan=input(str(process)+"---->")
        script.post({'type': 'break_test', 'payload':scan})