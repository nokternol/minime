import { OAuth2Client } from 'google-auth-library';

export class GoogleAuth {
  private client: OAuth2Client;
  readonly clientId: string;

  constructor(
    clientId: string,
    clientSecret: string,
    private redirectUri: string,
    private allowedEmail: string
  ) {
    this.clientId = clientId;
    this.client = new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  getAuthUrl() {
    return this.client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      access_type: 'offline',
    });
  }

  async exchange(code: string): Promise<{ email: string; name: string; picture: string }> {
    const { tokens } = await this.client.getToken(code);
    if (!tokens.id_token) throw new Error('OAuth response missing id_token');
    this.client.setCredentials(tokens);
    const ticket = await this.client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error('OAuth token payload missing');
    if (payload.email !== this.allowedEmail) {
      throw new Error('Email not allowed');
    }
    const { email, name, picture } = payload;
    if (!email || !name || !picture) throw new Error('OAuth payload missing required fields');
    return { email, name, picture };
  }
}
