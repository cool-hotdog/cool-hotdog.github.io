---
title: Lecture 1
publish: true
tags:
  - ML
  - Stanford
created: 2026-10-05T17:33:42.623Z
modified: 2026-10-05T17:33:42.623Z
description: ""
---
## Key ideas

### Most of the learning algorithms in a class rely on convex optimization algorithms


### What is ML?

	1. 让计算机在==无需明确编程==情况下具有学习能力（Arthur Samuel) 
	
	2. 对于某种任务，从某种经验中中学习后在该任务上在某种指标意义上 outperform 经验 （Tom Mitchell)


### Categories

#### Supervised Learning

- given a dataset (inputs X & labels Y),  learn a ==mapping== $X \rightarrow Y$. 

- regression: y is continuous. 

  classification: y takes on a discrete number of variables.

  **logistic reg**...
  
- Some terms
	**Support Vector Machine**: allows use ==infinite-dimensions== vectors input.
	
	**Back-propagation**:反向传播
	
	**Gradient-descent**:梯度下降


#### DL

**CS230** covers more narrowly on it.


#### Unsupervised Learning
	
- given a dataset without labels

- Examples
	 **K-means clustering**
		
	 **Cocktail party problem**:a noisy room, multiple microphones, record overlapping 
		
	 voices. separate out the people's voices. ——ICA（Independent Components Analysis)



#### Others
1.  **ML strategies**
	
2. **DL**
	
3. **RL**：we don't know the optimal way, so we use reward when the model behaves well.


