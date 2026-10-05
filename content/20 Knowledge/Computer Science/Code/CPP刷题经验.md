---
title: CPP刷题经验
publish: true
tags:
  - cpp
created: 2026-10-05T08:28:54.553Z
modified: 2026-10-05T08:28:54.553Z
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
