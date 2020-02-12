const net = require('net');
const os = require('os');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const {
    ApolloServer,
    gql,
    PubSub,
    withFilter
} = require('apollo-server');

const pubsub = new PubSub();




let logger = console.log
let options = {}
let bridgeConfig = null
let connection = null
let accessories = {}
let apollo = null
const typeDefs = gql `
  
  type Characteristic {
    type: String
    perms: [String]
    description: String
    
    iid: String
    value: String
  }
  
  type CharacteristicValue {
    aid: String
    iid: String
    value: String
  }

  type Service {
    iid: String
    type: String
    characteristics: [Characteristic]
  }

  type Accessory {
    aid: String
    services: [Service]
  }
  
  type Query {
    accessories: [Accessory]
    characteristic(aid: String, iid: String): CharacteristicValue!
  }

  type Subscription {
    characteristicChanged(aid: String, iid: String): CharacteristicValue
  }
`

const resolvers = {
    Query: {
        accessories: async (obj, args, context, info) => {
            // if((options.token && context.token === options.token) || context.token === bridgeConfig.pin)
            if(context.token === options.token)
            {
                const result = await axios({
                    url: `http://127.0.0.1:${bridgeConfig.port}/accessories`,
                    headers: {
                        "Authorization": bridgeConfig.pin,
                        "Content-Type": "application/json"
                    }
                })
    
                accessories = result.data.accessories
    
                return accessories
            }

            return []
        },
        characteristic: async (obj, {aid, iid}, context, info) => {
            // if((options.token && context.token === options.token) || context.token === bridgeConfig.pin)
            if(context.token === options.token)
            {
                const result = await axios({
                    url: `http://127.0.0.1:${bridgeConfig.port}/characteristics?id=${aid}.${iid}`,
                    headers: {
                        "Authorization": bridgeConfig.pin,
                        "Content-Type": "application/json"
                    }
                })

                return result.data.characteristics[0]
            }

            return {}
        }
    },
    Subscription: {
        characteristicChanged: {
            subscribe: withFilter(
                () => pubsub.asyncIterator('CHARACTERISTIC_CHANGED'),
                (payload, variables, context, info) => {
                    // if((options.token && context.Authorization === options.token) || context.Authorization === bridgeConfig.pin)
                    if(context.Authorization === options.token)
                    {
                        return payload.characteristicChanged.aid === Number(variables.aid) &&
                            payload.characteristicChanged.iid === Number(variables.iid);
                    }

                    return false
                },
            ),
        },
    },
}


module.exports = (homebridge) => {
    homebridge.on('shutdown', () => {
        logger('Homebridge shutdown')

        apollo.close()
    })

    homebridge.on('didFinishLaunching', () => {
        logger('Homebridge finished launching')
        setTimeout(() => {
            let configFile = null
            for (let i = 0; i < process.argv.length; i++) {
                const arg = process.argv[i]
    
                if (arg === '-U' || arg === '-user-storage-path') {
                    if (process.argv[i + 1]) {
                        configFile = path.resolve(process.env.PWD, process.argv[i + 1]) + '/config.json'
                        break
                    }
                }
            }
    
            if (configFile === null) {
                configFile = os.homedir() + '/config.json'
            }
    
            logger('Homebridge config file', configFile)
    
    
    
    
            if (fs.existsSync(configFile)) {
                const homebridgeConfig = require(configFile)
    
                bridgeConfig = homebridgeConfig.bridge

                options = homebridgeConfig.api


                const server = new ApolloServer({
                    typeDefs,
                    resolvers,
                    introspection: options.introspection || false,
                    playground: options.playground || false,
                    context: async ({
                        req,
                        connection
                    }) => {
                        if (connection) {
                            return connection.context;
                        } else {
                            const token = req.headers.authorization || "";
        
                            return {
                                token
                            };
                        }
                    },
                });
    
                axios({
                    url: `http://127.0.0.1:${bridgeConfig.port}/accessories`,
                    headers: {
                        "Authorization": bridgeConfig.pin,
                        "Content-Type": "application/json"
                    }
                }).then(result => {
                    accessories = result.data.accessories
    
    
                    server.listen({
                        port: options.port
                    }).then(({
                        url,
                        server
                    }) => {
                        apollo = server
                        logger(`API Server ready at ${url}`);
                    });
    
                    connection = net.createConnection(bridgeConfig.port, '127.0.0.1')
    
                    connection.setKeepAlive(true)
        
        
                    connection.on('error', e => {
                        logger('Homebridge socket error', e)
                    })
        
                    connection.on('connect', () => {
                        logger('Homebridge socket connected')
                    })
        
                    connection.on('data', data => {
                        const body = data + ''
                        if(body.indexOf('EVENT/') === 0)
                        {
                            const firstPosition = body.indexOf('{')
                            const lastPosition = body.lastIndexOf('}')
                            const characteristics = JSON.parse(body.substr(firstPosition, lastPosition - firstPosition + 1)).characteristics
        
                            logger("Got characteristic event", characteristics)
    
                            for(let characteristic of characteristics)
                            {
                                pubsub.publish('CHARACTERISTIC_CHANGED', {
                                    characteristicChanged: characteristic
                                })
                            }
                        }
                    })
        
                    let body = {
                        characteristics: []
                    }
        
                    for(let accessory of accessories) {
                        for(let service of accessory.services) {
                            for(let characteristic of service.characteristics) {
                                if(characteristic.perms && characteristic.perms.indexOf('ev'))
                                {
                                    body.characteristics.push({
                                        aid: accessory.aid,
                                        iid: characteristic.iid,
                                        ev: true
                                    })
                                }
                            }
                        }
                    }
        
                    body = Buffer.from(JSON.stringify(body))
        
                    const data = Buffer.concat([
                        Buffer.from(`PUT /characteristics HTTP/1.1\r\n`),
                        Buffer.from(`Authorization: ${bridgeConfig.pin}\r\n`),
                        Buffer.from(`Content-Type: application/hap+json\r\n`),
                        Buffer.from(`Content-Length: ${body.length}\r\n\r\n`),
                        body,
                    ])
        
                    connection.write(data)
                })
    
    
                
            }
        }, 5000)
        

    })

}