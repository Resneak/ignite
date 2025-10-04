export default class Akamai {
    private blockMessages = ['Access Denied'];

    public checkResponse(response: any) {
        let blockedMessage;
        for (const message of this.blockMessages) {
            if (response?.body?.includes(message)) {
                blockedMessage = message;
                break;
            }
        }

        return blockedMessage;
    }

    private handleBlock() {}
}
