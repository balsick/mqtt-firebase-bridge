#!/usr/bin/env node
const mqttFirebase = require('../lib/mqtt-firebase.js')

if (require.main === module)
    mqttFirebase.start(process.argv.slice(2))
else
    mqttFirebase.start()