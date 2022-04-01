# fridaMemoryAccessTrace


### 这是一个基于Frida的，Android端，native层，内存访问trace

```
usage: main.py [-h] -l LENGTH [-n NAME] [-lp] (-b BREAK | -o OFFSET | -s SYMBOL)

optional arguments:
  -h, --help            show this help message and exit
  -l LENGTH, --length LENGTH
                        输入断点的长度最长不能超过pagesize
  -n NAME, --name NAME  输入程序包名
  -lp, --listproc       展示进程
  -b BREAK, --break BREAK
                        输入绝对地址，例如0x12345678
  -o OFFSET, --offset OFFSET
                        输入相对地址，例如libxxx.so@0x1234
  -s SYMBOL, --symbol SYMBOL
                        输入符号，例如libxxx.so@test_value

```
#### 测试程序主要代码

```c
_Noreturn void* thread_1(void * arg){
    while (true){
        for (int i =0;i<4;i++){
            *((char *)&test_value+i) = *((char *)&my_test+i);
        }
        test_value++;
        sleep(1);
    }
}
 pthread_create(&thread1, nullptr, thread_1, nullptr);
```

#### 使用示例
```
python 需要安装模块 hexdump

64位
adb install -t ./app-debug64.apk
python3 ./main.py -s libnative-lib.so@test_value -l 4 -n "My Application"

32位
adb install -t ./app-debug32.apk
python3 ./main.py -s libmyapplication32.so@test_value -l 4 -n MyApplication32

```
**64位**
![!image](assets/1.gif)
**32位**
![!image](assets/32.png)

#### 已知问题
多线程同时有概率崩溃
