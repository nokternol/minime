import { OAuth2Client } from 'google-auth-library'

export class GoogleAuth {
  private client: OAuth2Client

  constructor(
    clientId: string,
    clientSecret: string,
    private redirectUri: string,
    private allowedEmail: string
  ) {
    this.client = new OAuth2Client(clientId, clientSecret, redirectUri)
  }

  getAuthUrl() {
    return this.client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      access_type: 'offline',
    })
  }

  async exchange(code: string): Promise<{ email: string; name: string; picture: string }> {
    const { tokens } = await this.client.getToken(code)
    this.client.setCredentials(tokens)
    const ticket = await this.client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: this.client._clientId,
    })
    const payload = ticket.getPayload()!
    if (payload.email !== this.allowedEmail) {
      throw new Error('Email not allowed')
    }
    return { email: payload.email!, name: payload.name!, picture: payload.picture! }
  }
}
