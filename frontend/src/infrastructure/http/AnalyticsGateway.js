export class AnalyticsGateway {
  constructor(http) { this.http = http }
  async dashboard(filter, options) {
    return (await this.http.request(`/api/analytics/dashboard?${new URLSearchParams(filter)}`, options)).data
  }
}
