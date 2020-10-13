# mqtt-firebase-bridge
Bridge between Firebase and MQTT. It is compatible with npx usage and installable as global node module.

# Sample usage
The application needs mqtt broker information. Visit [mqtt's github page](https://github.com/mqttjs/MQTT.js) for full parameters setup.
```
npx mqtt-firebase -h mqtt.mybroker.dev 
```
With this command, you'll post on your firebase database every mqtt message published on your broker on every topic to a corresponding firebase database node.

> N.B.: you need to have your [serviceaccount.json file](https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk) in the `cwd`.

> You can also specify the path to `serviceaccount.json` by using `--sa` or `--serviceaccount`
```
npx mqtt-firebase -h mqtt.mybroker.dev -sa path/to/serviceaccount.json
```

# Advanced usage
You can configure advanced mapping, choose what topics to subscribe to and what is the firebase database's destination node for every topic by configuring a `config.json` file in `cwd` or specifying its path via `--config`, `--cfg` or `-c`.

It is made of two sections: 
- mqtt configuration
- topics configuration

In mqtt section you can set all the params needed by [mqtt](https://github.com/mqttjs/MQTT.js) to subscribe.

In topics configuration, you put an array of objects containing:
- the topic to subscribe to
- the firebase database destination node

They can contain escaped tokens too.
e.g.
```
{
    "topics": [ {
        "topic": "/abc/iot/{a}/{b}",
        "dbNode": "abc_iot_{a}_{b}"
    }, {
        "topic": "/abc/iot/{a}/{b}"
    }, {
        "topic": "/abc/iot/{a}/103",
        "dbNode": "{a}_103"
    }, {
        "topic": "/abc/iot/#",
        "dbNode": "all"
    } ]
}
```
Every token becomes a `+` during the subscription.

More than one configuration topics can match and the data will be written in every node matched.

Data is transposed as-is, no mapping can be performed for now.