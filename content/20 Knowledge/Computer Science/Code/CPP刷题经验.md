---
title: CPP刷题经验
publish: true
tags:
  - cpp
  - CS
created: 2026-10-13T05:54:42.427Z
modified: 2026-10-13T05:54:42.427Z
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

至于使用冒泡/插入/归并排序，只是因为这几种排序算法具有稳定性，可以适配在这方面有要求的题目。

那么我们应该怎么进行二次排序呢？例如对 value 相同的对象内部再按  key 的字典序排序？

如果我们坚持使用平行数组，那需要我们在交换条件上做文章。所谓的“二次排序”“三次排序”以至于”n次排序“都是在优先级更高的变量相等时，比较一个次优先级的变量。因此我们将swap的条件改变为如下形式即可

```cpp
if (value[a] > value[a + 1] ||
	(value[a] == value[a + 1] &&
	key[a] > key[a + 1]) ||
	... 
	)
```

**sort()**

比较简单粗暴，如果我们使用了pair，其默认按字典序来排序。

### 处理各类输入

在处理不知道有多少行数据输入，也没有标识 EOF 的输入时（like 0 )，我们应该如何处理？

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

但以上是我们知道列数时使用的方法。如果我们只知道行数，或行数列数都不知道怎么办？这需要用到getline()函数等工具……

```cpp
// getline大概分为两类
getline(cin, line) //读入输入流，以换行符或EOF终止，输入被命名为line
getline(cin, line, ',') //读入输入流，以EOF终止，以逗号作为分隔符，输入被命名为line

//在处理只知道行数时且无分割符，我们直接用一维数组即可
int a[k];
for (int i = 0; i < k; i ++) {
	cin >> a[i];
}

// 若有分隔符
int a[k];
for (int i = 0; i < k; i ++) {
	string line, num;
	getline(cin, line);
	stringstream ss(line);
	vector<int> row;
	while (getline(ss, num, ',')) {
        row.push_back(stoi(num));
    }
}

//在只知道列数时且无分割符
int x1, y1, x2, y2, x3, y3, x4, y4;
while (cin >> x1 >> y1
	        >> x2 >> y2
	        >> x3 >> y3
	        >> x4 >> y4) {

	        }
	        
//只知道列数且有分割符
```