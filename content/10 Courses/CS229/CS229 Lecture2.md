---
title: CS229 Lecture2
publish: true
tags:
  - ML
  - CS
  - Stanford
created: 2026-10-09T05:30:09.549Z
modified: 2026-10-09T05:30:09.549Z
description: Linear Regression and Gradient Descent
---
# CS229 Lecture2

## Key ideas

线性回归是最简单的监督学习算法。

 模型：
$$
\begin{aligned}
H(x) &= \theta_{0} + \sum_{i=1}^{n}\theta_{i}X_i\\
\end{aligned}
$$

以下是一些本课程会用到的符号及其含义，我们称：

$\theta$为参数（parameters)；$M$为训练样本数量（the number of training example)；$x$为输入或特征（input/feature）；$Y$为输出或目标变量（input/target variable) ；$(x, y )$ 为训练样本（training example）；$(x^{(i)},y^{(i)})$是第i个训练样本；$n$为特征数量

### How to choose $\theta$ ?

目标：让 $h(x)$接近训练样本，简单来说就是让残差平方和最小

原理我们在统计学相关课程中我们已了解，不过多赘述。

我们定义：
$$
J(\theta) = \frac{1}{2}\sum_{i=1}^{m}(h(x^{(i)})-y^{(i)})^{2}
$$
我们希望最小化这个函数
## Derivation / proof

### OLS证明

 老师使用梯度下降来解决，似乎这是为了符合ML的习惯
 
 我们需要初始化$\theta$，不妨令$\vec{\theta} = \vec{0}$ 

$$
\theta_j := \theta_{j} - \alpha \frac{\partial}{\partial\theta_j}J(\theta)
$$
我们称$\alpha$为学习率（learning rate)

$$
\frac{\partial}{\partial\theta_j}J(\theta)
$$

## Questions

## Extract to Knowledge
- [[]]

## Source
