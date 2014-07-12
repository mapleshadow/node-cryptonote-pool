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
最高难度要合理，官方的太大了，500000差不多了，1000000都不过分，看算力

关于效率：
默认的1000是XMR币，XMR是60秒一个块，用500，效率还不错。
那么假如60秒=500的话，4分钟240秒=2000,120秒=1000，

查手续费：
找源代码src/cryptonote_config.h
找
#define COIN                                            ((uint64_t)1000000000000) // pow(10, 12)
#define DEFAULT_FEE                                     ((uint64_t)   5000000000) // 5 * pow(10, 9)
一个是币1个币的值
一个是1个币需要多少手续费
