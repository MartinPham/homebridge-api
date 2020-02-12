# Homebridge API (GraphQL based)

### WTF?

I was trying to build integrations between Homebridge and Alexa, but I couldn't find anything about Homebridge API, to get accessories & listen to statuses change. So I decided to build my own.

Homebridge API is based on GraphQL spec, currently it supports:

- Getting accessories & services & characteristics
- Querying characteristic's value
- Subscribing to characteristic's value change in realtime
- (Incoming) Setting characteristic's value

### Installation
- Start Homebridge in Insecure mode ***(Important)***
- Install the plugin

```
npm i -g homebridge-api
```

- Add config 
Check [sample-config.json](./sample-config.json) file

```
{
	"bridge": {
		...
	},
	"api": {
		"port": 18110,
		"token": "TOP-SECRET-LOL",
		"introspection": true,
		"playground": true
	}
}
```

Where:

1. `port` GraphQL server port
2. `token` Token to access the GraphQL
3. `introspection` Enable GraphQL introspection (should disable it for public)
4. `playground` Enable GraphQL playground (should disable it for public)

- Restart Homebridge

### Play time

**Don't forget to set header**

```
Authorization: YOUR-ACCESS-TOKEN-HERE
```

- Query accessories

```
accessories {
	aid
	services {
		type
		characteristics {
			iid
			type
			value
		}
	}
}
```
- Query characteristic

```
query {
  characteristic(aid: "21", iid: "10")
  {
    value
  }
}
```

- Subscribe to characteristic's value

```
subscription {
  characteristicChanged(aid: "21", iid: "10")
  {
    value
  }
}
```

---

### TODO
- [ ] Mutation for updating characteristic
- [ ] Refactor
- [ ] Classic REST API