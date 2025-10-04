import { connect } from 'react-redux';
import { Dispatch } from 'redux';
import { SettingsAction, updateDiscordWebhook } from '../../../actions/settingsActions';
import { RootState } from '../../../reducers';
import Integrations from './Integrations';

const mapStateToProps = (state: RootState) => ({
    discordWebhookUrl: state.settings.discordWebhookUrl,
});

const mapDispatchToProps = (dispatch: Dispatch<SettingsAction>) => ({
    updateDiscordWebhook: (url: string) => dispatch(updateDiscordWebhook(url)),
});

export default connect(mapStateToProps, mapDispatchToProps)(Integrations);
