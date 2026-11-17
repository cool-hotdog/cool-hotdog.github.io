---
title: CS229 Lecture3
publish: true
tags:
  - ML
  - CS
  - Stanford
created: 2026-11-17T16:54:34.813Z
modified: 2026-11-17T16:54:34.813Z
description: Locally weighted Reg  & Logistic Reg
---
## Key ideas

### Parametric learning algorithm vs Non-parametric learning algorithm

参数是否内生是两者区别

### Locally weighted reg(局部加权线性回归)

本质上是用直线拟合局部的曲线
损失函数
$$
Loss = \sum^{m}_{i=1}\omega^{(i)}(y^{i}-\theta^{\top}x^{i})^2
$$
其中
$$
\omega = e^{-\frac{(x-x^i)^2}{2\tau^2}}
$$
权重把$x$和$x^i$的距离压缩到$[0,1]$之间，给距离较近的点更大的权重。
$\tau$是带宽参数（bandwidth）决定了观察窗口，其越大，观察窗口就越大，拟合的曲线也就越平滑，反之会呈现锯齿状。

比较适用于低维度数据（计算成本）

###  Probability Interpretation

为什么我们在损失函数中使用平方，而不是三次方四次方。

我们假定残差$\epsilon～N(0,\sigma^2)$（自然被解释变量也服从正态分布）

在这个前提，残差平方和等价于极大似然估计（MLE）

$$
L(\theta)=\prod^{m}_{i=1}p(y^i|x^i;\theta)
=\prod^{m}_{i=1}\frac{1}{\sqrt{2\pi}\sigma}e^{-\frac{(y^i-\theta^{\top}x^i)^2}{2\sigma^2}}
$$

