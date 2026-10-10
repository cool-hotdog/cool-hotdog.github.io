---
title: CS229 Lecture2
publish: true
tags:
  - ML
  - CS
  - Stanford
created: 2026-10-10T06:22:01.104Z
modified: 2026-10-10T06:22:01.104Z
description: Linear Regression and Gradient Descent
---
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

$J(\theta)$示意图，不难看出，唯一的局部最优解也是全局最优解

![[Pasted image 20261009134610.png]]

### How to choose learning rate?
多尝试几个学习率，比如0.01……

如果损失函数反而增大，学习率往往过大

可以以指数或倍增的方式来找学习率


有时对于整个训练集使用的梯度下降法，也叫做批量梯度下降（Batch Gradient descent)。其缺点在于，在进行一次梯度下降时，需要计算整个训练集，当训练集很大时，这会非常缓慢。

因此我们引入随机梯度下降（Stochastic gradient descent)
### 随机梯度下降

对于每个$\theta$

$$
\begin{aligned}
\theta_j &:= \theta_j-\alpha(h_\theta(x)-y)x_j
\end{aligned}
$$
我们每次只针对一个训练样本更新参数

参数永远在震荡，不会收敛

更常见的做法是，在使用随机梯度下降时，逐步降低学习率，让震荡频率逐渐缩小

## Mathematical proof

### OLS证明

 老师使用梯度下降来解决，似乎这是为了方便后续的教学
 
 我们需要初始化$\theta$，不妨令$\vec{\theta} = \vec{0}$ 

$$
\theta_j := \theta_{j} - \alpha \frac{\partial}{\partial\theta_j}J(\theta)
$$
我们称$\alpha$为学习率（learning rate)

不妨设 $m = 1$，则

$$
\begin{aligned}
\frac{\partial}{\partial\theta_j}J(\theta) &= (h_\theta(x)-y)\frac{\partial}{\partial \theta_j}(h_\theta(x)-y)\\
&=(h_\theta(x)-y)\frac{\partial}{\partial \theta_j}(\sum_{i=0}^{n}\theta_ix_i-y)
\end{aligned}
$$
PS：可以看到求偏导时，求和中只有和 $\theta_j$对应的一项不为0，其他全为0

从而：

$$
\begin{aligned}
\theta_j &:= \theta_{j} - \alpha \frac{\partial}{\partial\theta_j}J(\theta)\\
&:=\theta_j-\alpha(h_\theta(x)-y)x_j
\end{aligned}
$$
更近一步，$m > 1$时，

$$
\begin{aligned}
\theta_j &:= \theta_{j} - \alpha \frac{\partial}{\partial\theta_j}J(\theta)\\
&:=\theta_j-\alpha\sum_{i=1}^{m}(h_\theta^{(i)}(x)-y^{(i)})x_j^{(i)}
\end{aligned}
$$
### OLS的另一种推导
我们给出：标量对向量求导的法则

$$
\nabla_{\theta}J(\theta) = \begin{pmatrix}
\frac{\partial J}{\partial \theta_0}\\
\frac{\partial J}{\partial \theta_1}\\
\vdots\\
\frac{\partial J}{\partial \theta_n}
\end{pmatrix}
$$
以及，标量对矩阵求导的法则，定义：$f(A)：\mathbf{R}^{m\times n} \rightarrow \mathbf{R}$
$$
\nabla_Af(A)=\begin{pmatrix}
\frac{\partial}{\partial A_{11}}f & \frac{\partial}{\partial A_{12}}f & \cdots \frac{\partial}{\partial A_{1n}}f \\
\vdots & \ddots & \vdots \\
\frac{\partial}{\partial A_{m1}}f & \frac{\partial}{\partial A_{m2}}f & \frac{\partial}{\partial A_{mn}}f
\end{pmatrix}
$$

实际上这是Jacobian矩阵
令：
$$
\nabla_\theta J(\theta) =\vec{0}
$$
基于此进一步求解,我们称下面的矩阵为设计矩阵（design matrix)

$$
\mathbf{X} = \begin{pmatrix}
\mathbf{x}^{(0)} & \cdots & \mathbf{x^{n}}
\end{pmatrix}
$$
从而

$$
\begin{aligned}
J(\theta) &= \frac{1}{2}(\mathbf{X}\mathbf{\theta} - y)^{\top}(\mathbf{X}\mathbf{\theta} - y)\\
\nabla_\theta J(\theta) &= \frac{1}{2}\nabla_\theta(\mathbf{X}\mathbf{\theta} - y)^{\top}(\mathbf{X}\mathbf{\theta} - y)\\
&=\frac{1}{2}\nabla_\theta(\mathbf{\theta}^{\top}\mathbf{X}^{\top}-y^{\top})(\mathbf{X}\mathbf{\theta} - y)\\
&=\frac{1}{2}\nabla_\theta(\mathbf{\theta}^{\top}\mathbf{X}^{\top}\mathbf{X}\mathbf{\theta}-\mathbf{\theta}^{\top}\mathbf{X}^{\top}y-y^{\top}\mathbf{X}\mathbf{\theta}+y^{\top}y)\\
&= \mathbf{X}^{\top}\mathbf{X}\mathbf{\theta}-\mathbf{X}^{\top}y=0\\
&\rightarrow \theta = (\mathbf{X}^{\top}\mathbf{X})^{-1}X^{\top}y
\end{aligned}
$$

若 $\mathbf{X}^{\top}\mathbf{X}$不可逆，说明特征共线性，我们应该进一步处理特征。

