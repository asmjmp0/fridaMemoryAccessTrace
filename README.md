# fridaMemoryAccessTrace


### 这是一个基于Frida的，Android端，native层，内存访问trace

```
使用方法 python3 BreakPoint.py <Android中运行程序的进程名>
示例 python3 BreakPoint.py com.example.jnitest
```
#### 当出现---->时输入以下命令

```
b 绝对地址
o so的名称!相对地址
s so的名称!符号
```
#### 测试程序主要代码

```c
void check_func(){
    my_number=my_number+10;
    if(my_number==20)
        LOGI("%s","right");

}
```

#### 使用示例
```
meipengtao@MacBook-Pro fridaMemoryBreakPointer % python3 BreakPoint.py com.example.jnitest
Session(pid=22367)
run successfully
Session(pid=22367)---->o libnative-lib.so!0x4004
Session(pid=22367)---->
0xd9f1a004

type: read
data target address: 0xd9f1a004 libnative-lib.so!0x4004
PC : 0xd9f167f0 libnative-lib.so!_Z10check_funcv+0x7
ASM str: ldr r1, [r0]
Register: r1: 0xff98633c r0: 0xd9f1a004 
0xd9f1a004:
           0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F  0123456789ABCDEF
00000000  0a 00 00 00 00 00 00 00 00                       .........

type: write
data target address: 0xd9f1a004 libnative-lib.so!0x4004
PC : 0xd9f167f4 libnative-lib.so!_Z10check_funcv+0xb
ASM str: str r1, [r0]
Register: r1: 0x14 r0: 0xd9f1a004 
0xd9f1a004:
           0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F  0123456789ABCDEF
00000000  0a 00 00 00 00 00 00 00 00                       .........

type: read
data target address: 0xd9f1a004 libnative-lib.so!0x4004
PC : 0xd9f167f6 libnative-lib.so!_Z10check_funcv+0xd
ASM str: ldr r0, [r0]
Register: r0: 0xd9f1a004 r0: 0xd9f1a004 
0xd9f1a004:
           0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F  0123456789ABCDEF
00000000  14 00 00 00 00 00 00 00 00                       .........
```

#### 完成度
目前bug比较多，不限于只能设置一次且一个断点，随时有可能crash，厉害的大佬可以pr。
