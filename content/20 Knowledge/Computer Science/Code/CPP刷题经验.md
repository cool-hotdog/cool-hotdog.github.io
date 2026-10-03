---
title: CPP刷题经验
publish: true
tags:
  - cpp
created: 2026-10-03T08:06:53.703Z
modified: 2026-10-03T08:06:53.703Z
description: 保留前导零：C++ 中字符串输入与 setw、setfill 格式化输出。
---
- 如何处理输入输出格式为“001”、“046”这样的整数？
**输入**
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