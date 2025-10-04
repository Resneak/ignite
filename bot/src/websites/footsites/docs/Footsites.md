# Footsites
* General notes and anything interesting found can be placed here for future reference
## Protections
* Queue
* Fastly
* GeeTest

# Queue
* Before releases you are put in a queue to access the site

## Known Bypasses

### CFNetwork User-Agent 
* __STATE__: Valid
* __Effect__: Bypasses Queue (but seems like it has to be used for all requests, not just session)

```
Footlocker: Footlocker/CFNetwork/Darwin
Champs Sports: ChampsSports/CFNetwork/Darwin
Eastbay: Eastbay/CFNetwork/Darwin
Kids Footlocker: KidsFootlocker/CFNetwork/Darwin
Foot Action: FootAction/CFNetwork/Darwin
```

### Shielding
* `Fastly-FF` 
* `'cache-control': ${'------------------------'.repeat(1000)}`


# Fastly
* CDN
* Architecture - Reverse Proxy, Varnish
* Cache content stored on an origin server(s) at Points of Presence (POPs) around the world
## Goal
* Increase cache hits to provide content to users fast
* Distribute requests 
* Protect origin from spikes 
  

## Methods
* Shielding
* Clustering

## [Caching ](https://developer.fastly.com/learning/concepts/cache-freshness/)
```
We won't necessarily store objects for the full TTL requested, and may evict less popular objects earlier, especially if they are large. We also do not automatically evict objects when they reach their TTL. They simply become stale.
```

## Known Bypasses
### [Fastly-FF](https://developer.fastly.com/reference/http-headers/Fastly-FF/)  
* __STATE__: Unknown
* __EFFECT__: Bypasses shielding
* __PROCESS__: Include the `fastly-ff` header in a request for an item using shielding
* Format: According to the docs it is: `{serviceIDHash}!{dataCenter}!{server}` but it has been used as
  *  `!BWI!cache-bwi5139` 
  *  `!!cache-bwi5125-BWI`
  *  Example from docs `qZarR/12OL0QOq4VyQPmqQ/CTp17AZv0d6cSG5nUSxU=!WDC!cache-wdc5548-WDC`


## Cache Nodes

* Airport codes
```
'BWI','DCA','IAD','WDC','FTY','PDK','BOS','CHI','MDW','ORD','PWK','CMH','LCK','DAL','DFW','DEN','IAH','JAX','MCI','BUR','LGB','MIA','MSP','STP','YUL','LGA','EWR','PAO','PHX','PDX','SJC','SEA','STL','YYZ','YVR','BOG','EZE','CWB','LIM','GIG','SCL','CGH','GRU','AMS','CPH','DUB','FRA','HHN','HEL','LCY','LHR','LON','MAD','MAN','MRS','MXP','MUC','OSL','CDG','BMA','VIE','AKL','BNE','FJR','HKG','MEL','ITM','PER','QPG','SIN','SYD','HND','NRT','TYO','WLG','CPT','ACC','JNB','MAA','BOM','DEL'
```



### [Server Name Indication](https://en.wikipedia.org/wiki/Server_Name_Indication)
* Allows a server to present multiple certificateso on the same ip address and tcp port
* Useful for virtual hosting. TLS handshake occurs before the server sees headers, so it uses SNI to pick pick the correct certificate based on hostname.
* Related: Virtual Hosting

* [TLS hostnames](https://docs.fastly.com/en/guides/connecting-to-origins#setting-the-tls-hostname)
```
Normally we check the server certificate against the hostname portion of the address for your origin entered in the Create a host window. Checking the certificate is done by using the value of the Certificate Hostname field in your origin TLS settings. To have Fastly verify the certificate using a different hostname, specify it via the SNI Hostname field under Advanced options.
```

### [Virtual Hosting](https://en.wikipedia.org/wiki/Virtual_hosting)
* Name-Based virtual hosts use host names for the same ip
* Requires requests to the server to include the target hostname (i.e. set Host http header)


* `k.sni.global.fastly.net`


### Domains and IP Addresses
* [Public IP List](https://api.fastly.com/public-ip-list)
* [Targeting all TLS nodes](https://docs.fastly.com/en/guides/adding-cname-records#tls-enabled-hostnames): `k.sni.global.fastly.net` or `j.sni.global.fastly.net` (different version of TLS)
* [Targeting all HTTP nodes](https://docs.fastly.com/en/guides/adding-cname-records#tls-enabled-hostnames): `nonssl.global.fastly.net`
  * Fastly's non-TLS hostnames refuse HTTPS connections (port 443) to prevent TLS certificate mismatch errors.
  * Targeting all Nodes in North America and EU: `nonssl.us-eu.fastly.net` (I would assume the same can be done with TLS nodes)
* Targeting a POP: use the format `<POP AIRPORT CODE>-v4.pops.fastly-insights.com` (e.g. `man-v4.pops.fastly-insights.com`)
* Cache nodes in `/lib/data/cacheNodes.json` were gathered by a brute force dns search of airport codes for fastly POPs and numbers between 0 - about 38000. Updated around July 1st 2021. They have not all be confirmed to be valid.
* These all seem to point to BWI 
```
    '151.101.250.18',
    '151.101.250.17',
    '151.101.250.21',
    '151.101.250.26',
    '151.101.250.20',
    '151.101.250.29',
    '151.101.250.32',
    '151.101.250.27',
    '151.101.250.33',
    '151.101.250.28',
    '151.101.250.20',
    '151.101.250.27',
    '151.101.250.17',
    '151.101.250.18',
    '151.101.250.28',
    '151.101.250.42',
    '151.101.250.34',
    '151.101.250.29',
    '151.101.250.32',
    '151.101.250.36',
    '151.101.250.47',
    '151.101.250.79',
    '151.101.250.81',
    '151.101.250.63',
    '151.101.250.66',
    '151.101.250.39',
    '151.101.250.73',
    '151.101.250.67',
    '151.101.250.85',
    '151.101.250.78',
    '151.101.250.21',
    '151.101.250.64',
    '151.101.250.52',
    '151.101.250.87',
    '151.101.250.80',
    '151.101.250.77',
    '151.101.250.41',
    '151.101.250.136',
    '151.101.250.113',
    '151.101.250.35',
    '151.101.250.117',
    '151.101.250.33',
    '151.101.250.75',
    '151.101.250.99',
    '151.101.250.146',
    '151.101.250.83',
    '151.101.250.118',
    '151.101.250.93',
    '151.101.250.124',
    '151.101.250.88',
    '151.101.250.96',
    '151.101.250.114',
    '151.101.250.140',
    '151.101.250.128',
    '151.101.250.111',
    '151.101.250.82',
    '151.101.250.57',
    '151.101.250.56',
    '151.101.250.26',
    '151.101.250.49',
    '151.101.250.123',
    '151.101.250.74',
    '151.101.250.107',
    '151.101.250.106',
    '151.101.250.59',
    '151.101.250.58',
    '151.101.250.51',
    '151.101.250.127',
    '151.101.250.62',
    '151.101.250.60',
    '151.101.250.105',
    '151.101.250.98',
    '151.101.250.122',
    '151.101.250.130',
    '151.101.250.37',
    '151.101.250.151',
    '151.101.250.109',
    '151.101.250.71',
    '151.101.250.116',
    '151.101.250.112',
    '151.101.250.100',
    '151.101.250.115',
    '151.101.250.91',
    '151.101.250.72',
    '151.101.250.68',
    '151.101.250.137',
    '151.101.250.132',
    '151.101.250.61',
    '151.101.250.149',
    '151.101.250.120',
    '151.101.250.84',
    '151.101.250.156',
    '151.101.250.155',
    '151.101.250.131',
    '151.101.250.95',
    '151.101.250.133',
    '151.101.250.153',
    '151.101.250.144',
    '151.101.250.135',
    '151.101.250.138',
    '151.101.250.126',
    '151.101.250.145',
    '151.101.250.110',
    '151.101.250.45',
    '151.101.250.55',
    '151.101.250.103',
    '151.101.250.158',
    '151.101.250.46',
    '151.101.250.147',
    '151.101.250.43',
    '151.101.250.134',
    '151.101.250.38',
    '151.101.250.143',
    '151.101.250.154',
    '151.101.250.76',
    '151.101.250.161',
    '151.101.250.129',
    '151.101.250.163',
    '151.101.250.164',
    '151.101.250.167',
    '151.101.250.142',
    '151.101.250.121',
    '151.101.250.168',
    '151.101.250.160',
    '151.101.250.162',
    '151.101.250.171',
    '151.101.250.139',
    '151.101.250.152',
    '151.101.250.179',
    '151.101.250.166',
    '151.101.250.190',
    '151.101.250.174',
    '151.101.250.185',
    '151.101.250.165',
    '151.101.250.181',
    '151.101.250.186',
    '151.101.250.180',
    '151.101.250.191',
    '151.101.250.200',
    '151.101.250.184',
    '151.101.250.177',
    '151.101.250.196',
    '151.101.250.207',
    '151.101.250.197',
    '151.101.250.183',
    '151.101.250.169',
    '151.101.250.187',
    '151.101.250.213',
    '151.101.250.214',
    '151.101.250.192',
    '151.101.250.212',
    '151.101.250.215',
    '151.101.250.201',
    '151.101.250.194',
    '151.101.250.227',
    '151.101.250.198',
    '151.101.250.220',
    '151.101.250.209',
    '151.101.250.195',
    '151.101.250.204',
    '151.101.250.206',
    '151.101.250.202',
    '151.101.250.226',
    '151.101.250.205',
    '151.101.250.182',
    '151.101.250.222',
    '151.101.250.224',
    '151.101.250.219',
    '151.101.250.221',
    '151.101.250.170',
    '151.101.250.216',
    '151.101.250.235',
    '151.101.250.232',
    '151.101.250.238',
    '151.101.250.211',
    '151.101.250.228',
    '151.101.250.176',
    '151.101.250.245',
    '151.101.250.246',
    '151.101.250.248',
    '151.101.250.225',
    '151.101.250.249',
    '151.101.250.217',
  ```