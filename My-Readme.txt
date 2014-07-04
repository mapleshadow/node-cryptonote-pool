单独运行模式、各个模块分开独立运行：
矿池
node init.js -module=pool
API
node init.js -module=api
解锁区块
node init.js -module=unlocker
支付
node init.js -module=payments

难度：
最高难度要合理，官方的太大了，500000差不多了，100000都不过分，看算力