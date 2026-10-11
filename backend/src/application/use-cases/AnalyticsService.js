const { fail } = require('../../domain/errors');
const DAY = 86400000;
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw fail('Usa fechas YYYY-MM-DD.');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) throw fail('Fecha inválida.');
  return parsed;
}
class AnalyticsService {
  constructor(repository, clock = () => new Date()) { this.repository = repository; this.clock = clock; }
  async dashboard(input = {}) {
    const period = input.period || 'weekly';
    if (!['daily','weekly','monthly','custom'].includes(period)) throw fail('period debe ser daily, weekly, monthly o custom.');
    const top = Number(input.top || 5);
    if (![5,10].includes(top)) throw fail('top debe ser 5 o 10.');
    const today = date(this.clock().toISOString().slice(0,10));
    let start, end;
    if (period === 'custom' || input.startDate !== undefined || input.endDate !== undefined) {
      start = date(input.startDate); end = new Date(date(input.endDate).getTime() + DAY);
    } else {
      end = new Date(today.getTime() + DAY);
      start = period === 'monthly' ? new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),1)) : new Date(today.getTime() - (period === 'weekly' ? 6 : 0) * DAY);
    }
    if (start >= end || end - start > 366 * DAY) throw fail('El rango debe ser válido y no exceder 366 días.');
    return { range: { startDate: start.toISOString().slice(0,10), endDate: new Date(end - DAY).toISOString().slice(0,10), timezone: 'UTC' }, currency: 'MXN', ...await this.repository.dashboard({start:start.toISOString(),end:end.toISOString(),top}) };
  }
}
module.exports = { AnalyticsService };
