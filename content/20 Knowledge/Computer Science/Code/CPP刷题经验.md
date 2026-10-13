---
title: CPP刷题经验
publish: true
tags:
  - cpp
  - CS
created: 2026-10-13T05:05:19.429Z
modified: 2026-10-13T05:05:19.429Z
description: 计算概论（A）做题时的遇到的实用tricks
---
### 如何处理带前导零的整数？

**输入**  

用 string 来获取整个数字
```cpp
#include <string>
string number;
cin >> number;
```

**输出**
```cpp
#include <iomanip>
cout << setfill('0') << setw(n) << number << endl;
```
ps: setw = set width

n是格式所需位数
###  排序问题

接下来分别介绍使用/不使用sort()两种方法的排序

**平行数组 + 冒泡/插入/归并排序**

建立多个平行的数组等同于将对象的不同要素分开储存，且同一个对象的各个要素在其对应数组中的 index 都相同。

```cpp
char key[4] = {'a', 'b', 'c', 'd'};
int  value[4] = {a, b, c, d};
```


例如我们要对 value 进行排序，同时希望输出 value 时能同时输出 key。我们需要在对value排序时同步key数组的 index。

```cpp
swap(value[a], value[b]);
swap(key[a], key[b]);
```

至于为什么要使用冒泡/插入/归并排序，这是因为这几种排序算法具有稳定性，可以适配在这方面有要求的题目。

那么我们应该怎么进行二次排序呢？例如对 value 相同的对象内部再按  key 的字典序排序？

如果我们坚持使用平行数组法，那需要我们在交换条件上做文章。

### 处理无终止输入

在处理不知道有多少组数据输入，也没有标识 EOF 的输入时，我们应该如何处理？

```cpp
0 0 0 1 1 1 1 0
0 0 1 1 0 1 1 0
0 0 0 1 0 2 1 1
0 0 1 1 0 2 2 1
```

我们可以把 cin 本身作为一个 condition：
```cpp
int x1, y1, x2, y2, x3, y3, x4, y4;
while (cin >> x1 >> y1
	        >> x2 >> y2
	        >> x3 >> y3
	        >> x4 >> y4) {
	        // ……
	        }
```
