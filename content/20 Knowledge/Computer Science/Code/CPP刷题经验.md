---
title: CPP刷题经验
publish: true
tags:
  - cpp
created: 2026-10-05T07:44:00.100Z
modified: 2026-10-05T07:44:00.100Z
description: 计算概论（A）做题时的遇到的实用tricks
---
### 如何处理输入输出格式为“001”、“046”这样的整数？

**输入**
用 $string$ 来获取整个数字
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

在C++中，排序的处理比Python要复杂一些，主要体现为：没有内置好的字典用于排序，进而sort()函数便不是很好用了。