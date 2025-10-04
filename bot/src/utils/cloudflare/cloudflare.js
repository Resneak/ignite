const LZString = require('../ztools/lzstring');

class Cloudflare{
    constructor(taskCTRL){
        this.that = taskCTRL;
        this.md = null
    }

    async callToCloudflareApi(solution, host) {
        this.that.updateStatus("Submitting data")
        let headers = [
            [ 'method', 'POST' ],
            [ 'authority', host ],
            [ 'scheme', 'https' ],
            [ 'content-length', '2022' ],
            [ 'sec-ch-ua', '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"' ],
            [ 'sec-ch-ua-mobile', '?0' ],
            [ 'user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' ],
            [ 'cf-challenge', this.that.responseHawkApiPart1["url"].split("/").slice(-1)[0] ],
            [ 'content-type', 'application/x-www-form-urlencoded' ],
            [ 'accept', '*/*' ],
            [ 'origin', 'https://' + host ],
            [ 'sec-fetch-site', 'same-origin' ],
            [ 'sec-fetch-mode', 'cors' ],
            [ 'sec-fetch-dest', 'empty' ],
            [ 'referer', this.that.data.url ],
            [ 'accept-encoding', 'gzip, deflate, br' ],
            [ 'accept-language', 'en-US,en;q=0.9' ],
            [ 'cookie', this.that.cookie ]
        ],
        decodedApiResponse = Buffer.from(solution["result"], "base64").toString(),
        body =  `${this.that.responseHawkApiPart1["name"]}=${LZString.compressToEncodedURIComponent(decodedApiResponse, this.that.keyStrUriSafe)}`


        const response = await this.that.client(this.that.responseHawkApiPart1["url"], {
            headers,
            body,
            // rawProxy: "http://127.0.0.1:5555/"
        })

        this.that.challengeResponse = response
        if(response.Status === 400){
            return this.that.updateStatus("Could not submit cloudflare")
        }
    }

    async postFinal(host) {
        this.that.updateStatus("Sleeping before solving")
        await this.that.sleep(4500);
        this.that.updateStatus("Submitting final data")

        if(this.md) {
            this.that.finalPayload += `&md=${this.md}`
        }

        const response = await this.that.client(this.that.responseHawkApiPart1["result_url"], {
            method: "POST",
            headers: [
                [ 'method', 'POST' ],
                [ 'authority', host ],
                [ 'scheme', 'https' ],
                [ 'content-length', '2318' ],
                [ 'cache-control', 'max-age=0' ],
                [ 'sec-ch-ua', '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"' ],
                [ 'sec-ch-ua-mobile', '?0' ],
                [ 'upgrade-insecure-requests', '1' ],
                [ 'origin', 'https://' + host ],
                [ 'content-type', 'application/x-www-form-urlencoded' ],
                [ 'user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' ],
                [ 'accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9' ],
                [ 'sec-fetch-site', 'same-origin' ],
                [ 'sec-fetch-mode', 'navigate' ],
                [ 'sec-fetch-dest', 'document' ],
                [ 'referer', this.that.data.url ],
                [ 'accept-encoding', 'gzip, deflate, br' ],
                [ 'accept-language', 'en-US,en;q=0.9' ],
                [ 'cookie', this.that.cookie ]
            ],
            body: this.that.finalPayload,
            followRedirect: false,
        })

        this.that.data.url = this.that.responseHawkApiPart1["result_url"]
    }

    async callToHawkApiCaptchaPart2() {
        this.that.updateStatus("Solving cloudflare captcha [2]")
        
        let payload = {
            "body_sensor": Buffer.from(this.that.challengeResponse.Body).toString("base64"),
            "result": this.that.responseHawkApiPart1["baseobj"],
            "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        },
        captcha_response
    
        const response = await this.that.client("https://cf-v2.hwkapi.com/cf-a/ov1/cap2?auth=hawkkey", {
            rawProxy: "localhost",
            method: "POST",
            headers: [
                ["content-type", "application/json"]
            ],
            body: JSON.stringify(payload)
        })

        captcha_response = JSON.parse(response.Body)
        if(captcha_response["valid"]) {
            this.that.finalPayload = `r=${this.that.responseHawkApiPart1["r"]}&cf_captcha_kind=h&vc=${this.that.responseHawkApiPart1["pass"]}&captcha_vc=${captcha_response["jschl_vc"]}&captcha_answer=${captcha_response["jschl_answer"]}&cf_ch_verify=plat&h-captcha-response=captchka`
        }
    }

    async callToHawkApiCaptchaPart1(host) {
        this.that.updateStatus("Solving captcha [1]")
        let token

        if(this.that.responseHawkApiPart3["click"]) {
            token = "click"
        } else {
            token = await this.that.getCaptcha("https://" + host + "/", "", this.that.responseHawkApiPart3.sitekey, "V2", "hcaptcha")
        }
        let payload = {
            "result": this.that.responseHawkApiPart2["result"],
            "token": token,
            "data": this.that.responseHawkApiPart3["result"],
            "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        const response = await this.that.client("https://cf-v2.hwkapi.com/cf-a/ov1/cap1?auth=hawkkey", {
            rawProxy: "localhost",
            method: "POST",
            headers: [
                ["content-type", "application/json"]
            ],
            body: JSON.stringify(payload)
        })
        this.that.responseHawkApiCaptchaPart1 = JSON.parse(response.Body)
        if(this.that.responseHawkApiCaptchaPart1["md"])
            this.md = this.that.responseHawkApiCaptchaPart1["md"]
    
        await this.callToCloudflareApi(this.that.responseHawkApiCaptchaPart1, host)
    }

    async callToHawkApiPart3(host, body_, challengeBody) {
        this.that.updateStatus("Getting payload [3]")

        let payload = {
            "body_sensor": Buffer.from(this.that.challengeResponse.Body).toString("base64"),
            "result": this.that.responseHawkApiPart1["baseobj"],
            "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }    
        const response = await this.that.client("https://cf-v2.hwkapi.com/cf-a/ov1/p3?auth=hawkkey", {
            rawProxy: "localhost",
            method: "POST",
            headers: [
                ["content-type", "application/json"]
            ],
            body: JSON.stringify(payload)
        })

        try{
            this.that.responseHawkApiPart3 = JSON.parse(response.Body)}
        catch(err){
            console.log(err, payload)
            return
        }
        if(this.that.responseHawkApiPart3["status"] === "ok" && this.that.responseHawkApiPart3["captcha"] === false) {
            this.that.finalPayload = `r=${this.that.responseHawkApiPart1["r"]}&jschl_vc=${this.that.responseHawkApiPart3["jschl_vc"]}&pass=${this.that.responseHawkApiPart1["pass"]}&jschl_answer=${this.that.responseHawkApiPart3["jschl_answer"]}&cf_ch_verify=plat`
        } else if(this.that.responseHawkApiPart3["status"] == "rerun") {
            this.that.isRerun = true
            await this.callToHawkApiPart2(body_, challengeBody, undefined, host)
            await this.callToHawkApiPart3(host, body_, challengeBody)
        } else if(this.that.responseHawkApiPart3["captcha"] == true) {
            await this.callToHawkApiCaptchaPart1(host)
            await this.callToHawkApiCaptchaPart2(host)
        }
    }

    async callToHawkApiPart2(body, challengeBody, urlPart, host, isCaptcha) {
        this.that.updateStatus("Getting payload [2]")
        let payload
        if(!this.that.isRerun) {
            payload = {
                "body_home": Buffer.from(body).toString("base64"),
                "body_sensor": Buffer.from(challengeBody).toString("base64"),
                "result": this.that.responseHawkApiPart1["baseobj"],
                "ts": this.that.responseHawkApiPart1["ts"],
                "url": this.that.responseHawkApiPart1["url"],
                "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
        } else {
            payload = {
                "body_home": Buffer.from(body).toString("base64"),
                "body_sensor": Buffer.from(challengeBody).toString("base64"),
                "result": this.that.responseHawkApiPart1["baseobj"],
                "ts": this.that.responseHawkApiPart1["ts"],
                "url": this.that.responseHawkApiPart1["url"],
                "rerun": true,
                "rerun_base": this.that.responseHawkApiPart2["result"],
                "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
    
        }

        const response = await this.that.client("https://cf-v2.hwkapi.com/cf-a/ov1/p2?auth=hawkkey", {
            rawProxy: "localhost",
            method: "POST",
            headers: [
                ["content-type", "application/json"]
            ],
            body: JSON.stringify(payload)
        })
        try{
            this.that.responseHawkApiPart2 = JSON.parse(response.Body)
        }catch(err){
            return
        }

        return await this.callToCloudflareApi(this.that.responseHawkApiPart2, host)
    }

    async callToHawkApiPart1(body, urlPart, host, isCaptcha) {
        this.that.updateStatus("Getting payload [1]")
        
        let payload = {
            "body": Buffer.from(body).toString("base64"),
            "url": urlPart,
            "domain": host,
            "captcha": isCaptcha,
            "key": this.that.keyStrUriSafe,
            "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

        const response = await this.that.client("https://cf-v2.hwkapi.com/cf-a/ov1/p1?auth=hawkkey", {
            rawProxy: "localhost",
            method: "POST",
            headers: [
                ["content-type", "application/json"]
            ],
            body: JSON.stringify(payload)
        })

        if(response.Body === "error") return this.that.updateStatus("Error")

        this.that.responseHawkApiPart1 = JSON.parse(response.Body)

        if(this.that.responseHawkApiPart1["md"])
            this.md = this.that.responseHawkApiPart1["md"]

        return await this.callToCloudflareApi(this.that.responseHawkApiPart1, host)
    }

    async solveCloudflare(response_, host, func, params = []){
        let captcha = response_.Status === 403 ? true : false,
        urlPart = await this.getChallenge(host, captcha)
        await this.callToHawkApiPart1(response_.Body, urlPart, host, captcha)
        await this.callToHawkApiPart2(response_.Body, this.that.challengeResponse.Body, urlPart, host, captcha),
        await this.callToHawkApiPart3(host, response_.Body, this.that.challengeResponse.Body),
        await this.postFinal(host)
        if(func) await this.that[func](...params)

    }
    
    async getChallenge(host, captcha = false){
        this.that.updateStatus("Getting challenge")

        let scriptUrl, matches, regex, matchs, urlPart, matchString;
        if(captcha) {
            scriptUrl = `https://${host}/cdn-cgi/challenge-platform/h/g/orchestrate/captcha/v1`
        } else {
            scriptUrl = `https://${host}/cdn-cgi/challenge-platform/h/g/orchestrate/jsch/v1`
        }
        let response = await this.that.client(scriptUrl, {
            headers: [
                [ 'method', 'GET' ],
                [ 'authority', host ],
                [ 'scheme', 'https' ],
                [ 'cache-control', 'max-age=0' ],
                [ 'sec-ch-ua', '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"' ],
                [ 'sec-ch-ua-mobile', '?0' ],
                [ 'user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' ],
                [ 'accept', '*/*' ],
                [ 'sec-fetch-site', 'same-origin' ],
                [ 'sec-fetch-mode', 'no-cors' ],
                [ 'sec-fetch-dest', 'script' ],
                [ 'referer', this.that.data.url ],
                [ 'accept-encoding', 'gzip, deflate, br' ],
                [ 'accept-language', 'en-US,en;q=0.9' ],
                [ 'cookie', this.that.cookie ]
            ],
            // rawProxy: "http://127.0.0.1:5555/"
        })
        regex = /0\.[^('|/)]+/;
        
        matchs = response.Body.match(regex)
        urlPart = matchs[0];
    
        regex = /[\W]?([A-Za-z0-9+\-$]{65})[\W]/g;
        matches = response.Body.matchAll(regex);
        matches = Array.from(matches)

        for(let i = 0; i < matches.length; i++) {
            matchString = matches[i][1].replace(/,/g, "")
    
            if(matchString.includes("+") && matchString.includes("-") && matchString.includes("$")) {
                this.that.keyStrUriSafe = matchString
                break
            }
        }

        return urlPart
    }

    async solveFingerPrint(host, body, initUrl){
        this.that.updateStatus("Fetching challenge")

        let challenge = body.match(/(?<=<script async src=')(.*?)(?='>)/)[0],
        url = `https://${host}${challenge}`
        let headers = [
            [ 'method', 'GET' ],
            [ 'authority', host ],
            [ 'scheme', 'https' ],
            [ 'sec-ch-ua', '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"' ],
            [ 'sec-ch-ua-mobile', '?0' ],
            [ 'user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' ],
            [ 'content-type', 'application/json' ],
            [ 'accept', '*/*' ],
            [ 'sec-fetch-site', 'same-origin' ],
            [ 'sec-fetch-mode', 'cors' ],
            [ 'sec-fetch-dest', 'empty' ],
            [ 'accept-encoding', 'gzip, deflate, br' ],
            [ 'accept-language', 'en-US,en;q=0.9' ],
        ]
        const response = await this.that.client(url, {
            headers
        })
        await this.that.getFPSensorData(response.Body, initUrl, host)
    }
    async getFPSensorData(body_, initUrl, host){
        this.that.updateStatus("Getting sensordata")
        let body = JSON.stringify({
            "body": Buffer.from(body_).toString("base64"),
            "url": initUrl,
            "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        })
        const response = await this.that.client("https://cf-v2.hwkapi.com/cf-a/fp/p1?auth=hawkkey", {
            rawProxy: "localhost",
            method: "POST",
            headers: [
                ["content-type", "application/json"]
            ],
            body
        })
        responseHawkApiPart1 = JSON.parse(response.Body)
        return await solveCloudFlare(responseHawkApiPart1["result"], host)
    }
    async solveCloudFlare(payload, host){
        this.that.updateStatus("Submitting cloudflare")
        let body = JSON.stringify(payload["result"])
        const response = await this.that.client(payload["url"], {
            headers: [
                [ 'method', 'POST' ],
                [ 'authority', host ],
                [ 'scheme', 'https' ],
                [ 'content-length', '2022' ],
                [ 'sec-ch-ua', '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"' ],
                [ 'sec-ch-ua-mobile', '?0' ],
                [ 'user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' ],
                [ 'content-type', 'application/json'],
                [ 'accept', '*/*' ],
                [ 'origin', 'https://' + host + '/' ],
                [ 'sec-fetch-site', 'same-origin' ],
                [ 'sec-fetch-mode', 'cors' ],
                [ 'sec-fetch-dest', 'empty' ],
                [ 'origin', 'https://' + host + '/' ],
                [ 'accept-encoding', 'gzip, deflate, br' ],
                [ 'accept-language', 'en-US,en;q=0.9' ],
                [ 'cookie', this.that.cookie ]
            ],
            body
        })
    }
}

module.exports = Cloudflare