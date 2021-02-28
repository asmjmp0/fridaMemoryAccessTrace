# fridaMemoryAccessTrace


### 这是一个基于Frida的，Android端，native层，内存访问trace

```
usage: main.py [-h] -l LENGTH [-n NAME] (-b BREAK | -o OFFSET | -s SYMBOL)

optional arguments:
  -h, --help            show this help message and exit
  -l LENGTH, --length LENGTH
                        输入断点的长度最长不能超过0
  -n NAME, --name NAME  输入程序包名
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

adb install -t ./app-debug.apk
python3 ./main.py -s libnative-lib.so@test_value -l 4 -n com.mpt.myapplication
```
![!image](assets/1.gif)
#### 完成度
目前仅支持arm64，arm32待开发。

#### 已知问题
多线程同时有概率崩溃
