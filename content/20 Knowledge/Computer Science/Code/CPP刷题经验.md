---
title: CPP刷题经验
publish: true
tags:
  - cpp
created: 2026-10-05T11:22:38.529Z
modified: 2026-10-05T11:22:38.529Z
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

在C++中，排序的处理比Python要复杂一些，主要体现为：在处理多元字典序排序时，C++中没有Python中关键字排序这种简单的排序工具。

**处理方法：平行数组 + 冒泡/插入/归并排序**

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

至于为什么要使用冒泡/插入/归并排序，这是因为这几种排序算法具有稳定性，在一些问题中往往要求 value相同的键值对排序前后的相对顺序保持一致。对于没有这种要求的题目其实用什么方法无所谓。

那么我们应该怎么进行二次排序呢？例如对 value 相同的对象内部再按  key 的字典序排序？