enum IpcChannel {
    UpdateStatus = 'update::status',
    UpdateCheck = 'update::check',
    UpdateDone = 'update::done',
    HarvesterNew = 'harvester::new',
    HarvesterLogin = 'harvester::login',
    HarvesterRequestCaptcha = 'harvester::request-captcha',
    HarvesterRequestToken = 'harvester::request-token',
    HarvesterRemove = 'harvester::remove',
    HarvesterResult = 'harvester::result',
}

export default IpcChannel;
