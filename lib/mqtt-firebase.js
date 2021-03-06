const { existsSync, readFileSync } = require('fs')
const mqtt = require('mqtt')
const admin = require('firebase-admin')
const minimist = require('minimist')
const {JSONPath} = require('jsonpath-plus');

const tokenRegex = /\{(\w+)\}/g

function _start(mqttConfig, configPath) {
    let config = {topics: [{topic: (mqttConfig || {}).topic}]}
    if (existsSync(configPath))
        config = JSON.parse(readFileSync(configPath))
    let topics = config.topics
    if (mqttConfig === undefined) {
        console.log(`No explicit configuration set. Searching config.json`)
        if (!config) {
            console.log(`Cannot fine config.json. Quitting`)
            process.exit(1)
        }
        mqttConfig = config.mqtt
    }
    console.log(mqttConfig)
    console.log(topics)
    const db = admin.database();
    const mqttClient = mqtt.connect(mqttConfig)

    mqttClient.on('connect', () => {
        for (let topic of topics) {
            mqttClient.subscribe(initTopic(topic).subscribedTopic)
        }
        console.log(topics)
    })
    mqttClient.on('message', (topic, messageBuffer) => {
        console.log(`Received message on topic ${topic}`)
        let message = messageBuffer.toString()
        console.log(message)
        let bridgeTopics = extractBridgeTopics(topics, topic)
        console.log('bridgeTopics')
        console.log(bridgeTopics)
        for (let bc of bridgeTopics) {
            let targetNode = topic
            if (bc.dbNode) {
                let node = bc.dbNode
                let tokenPositions = bc.topic.split('/').reduce((pv, cv, ci) => {
                    pv[ci] = cv
                    return pv
                }, [])
                console.log('token positions')
                console.log(tokenPositions)
                let tokenValues = topic.split('/').reduce((pv, cv, ci) => {
                    pv[tokenPositions[ci]] = cv
                    return pv
                }, {})
                console.log('token values')
                console.log(tokenValues)
                if (bc.tokens)
                    for (let token of bc.tokens) {
                        let v = tokenValues[token]
                        console.log(`${token} value is ${v}`)
                        node = node.replace(token, v)
                    }
                console.log(`final solved node is ${node}`)
                targetNode = node
            }
            targetNode = targetNode.replace(/\./g, '_');
            console.log(targetNode)
            let dbMessage = extractMessage(JSON.parse(message), bc.mapper)
            console.log(dbMessage)
            db.ref(targetNode).push()
                .set(dbMessage, (error) => {
                    if (error)
                        console.log(error)
                    else
                        console.log(`${dbMessage} pushed to ${targetNode}`)
                })
        }

    })
}

function extractBridgeTopics(topics, topic) {
    return Object.values(topics).filter(tc => {
        let tcArray = tc.subscribedTopic.split('/').filter(s => s.length > 0)
        let topicArray = topic.split('/').filter(s => s.length > 0)
        let tcLength = tcArray.length
        let topicLength = topicArray.length
        if (!tc.topic.endsWith('#') && tcLength !== topicLength)
            return false
        for (let i = 0; i < Math.min(tcLength, topicLength); i++) {
            let tcItem = tcArray[i]
            let topicItem = topicArray[i]
            if (tcItem === topicItem || tcItem === '+')
                continue
            if (tcItem === '#')
                return true
            return false
        }
        return true
    })
}

function extractMessage(message, mapper) {
    if (!mapper)
        return message
    let dbMessage = {}
    for (let key of Object.keys(mapper)) {
        const path = mapper[key]
        let result
        if ((typeof path) === 'object')
            result = extractMessage(message, path)
        else if ((typeof path) === 'string' && path.startsWith('$'))
            result = JSONPath({path: path, json: message})
        else
            result = path
        if (Array.isArray(result) && result.length === 1)
            result = result[0]
        if (result)
            dbMessage[key] = result
    }
    return dbMessage
}

function initTopic(topic) {
    let tokens = topic.topic.match(tokenRegex)
    let t = topic.topic
    topic.subscribedTopic = t
    if (tokens && tokens.length > 0) {
        t = t.replace(tokenRegex, '+')
        topic.tokens = tokens
        topic.subscribedTopic = t
    }
    return topic
}

function start (args) {
    let mqttConfig;
    if (args === undefined) {
        args = {serviceaccount: './serviceaccount.json'}
    } else {
        args = minimist(args, {
            string: ['hostname', 'username', 'password', 'key', 'cert', 'ca', 'clientId', 'i', 'id', 'serviceaccount', 'database', 'config'],
            boolean: ['help', 'insecure', 'multiline'],
            alias: {
                port: 'p',
                hostname: ['h', 'host'],
                topic: 't',
                clientId: ['i', 'id'],
                username: 'u',
                password: 'P',
                multiline: 'M',
                protocol: ['C', 'l'],
                help: 'H',
                ca: 'cafile',
                serviceaccount: 'sa',
                database: ['fb', 'db'],
                config: ['c', 'cfg']
            },
            default: {
                host: 'localhost',
                topic: '#',
                serviceaccount: 'serviceaccount.json',
                config: 'config.json'
            }
            })
        mqttConfig = {port: args.port, topic: args.topic, username: args.username, password: args.password, ca: args.ca, hostname: args.hostname, clientId: args.clientId}
    }
    if (!args.serviceaccount) {
        console.log('missing serviceaccount file')
        process.exit(1)
    }
    let sa = JSON.parse(readFileSync(args.serviceaccount))
    admin.initializeApp({
        credential: admin.credential.cert(args.serviceaccount),
        databaseURL: `https://${sa.project_id}.firebaseio.com`
      });
    _start(mqttConfig, args.config)
}

exports.start = start