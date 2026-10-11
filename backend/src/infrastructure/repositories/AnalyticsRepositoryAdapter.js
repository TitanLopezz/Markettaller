const { AnalyticsRepositoryPort } = require('../../domain/ports/AnalyticsRepositoryPort');
class AnalyticsRepositoryAdapter extends AnalyticsRepositoryPort {
  constructor(pool) { super(); this.pool = pool; }
  async dashboard({start,end,top}) {
    // A single statement gives a consistent snapshot; all aggregation runs in PostgreSQL.
    const { rows } = await this.pool.query(`
      WITH filtered AS (
        SELECT * FROM shop_orders WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
      ), sales AS (
        SELECT * FROM filtered WHERE payment_status = 'pagado' AND status <> 'cancelado'
      ), summary AS (
        SELECT COALESCE(SUM(total_cents),0) AS revenue, COUNT(*) AS paid_orders,
          COUNT(DISTINCT user_id) AS customers, COALESCE(AVG(total_cents),0) AS average_order,
          COALESCE(SUM(total_cents)::numeric / NULLIF(COUNT(DISTINCT user_id),0),0) AS average_user FROM sales
      ), days AS (
        SELECT generate_series($1::timestamptz AT TIME ZONE 'UTC', ($2::timestamptz AT TIME ZONE 'UTC') - interval '1 day', interval '1 day') AS day
      ), daily AS (
        SELECT date_trunc('day',created_at AT TIME ZONE 'UTC') AS day,SUM(total_cents) AS revenue FROM sales GROUP BY 1
      ), classified AS (
        SELECT CASE WHEN status='cancelado' THEN 'Cancelado'
          WHEN status IN ('enviado','entregado') THEN 'Enviado'
          WHEN payment_status='pagado' THEN 'Pagado' ELSE 'Pendiente' END AS state FROM filtered
      ), states AS (
        SELECT label, COUNT(c.state) AS count FROM (VALUES ('Pendiente'),('Pagado'),('Enviado'),('Cancelado')) labels(label)
        LEFT JOIN classified c ON c.state=label GROUP BY label
      ), ranking AS (
        SELECT i.product_id, i.product_name, SUM(i.quantity) AS units,
          SUM(i.quantity::numeric * i.unit_price_cents) AS revenue
        FROM shop_order_items i JOIN sales s ON s.id=i.order_id
        GROUP BY i.product_id,i.product_name ORDER BY units DESC,revenue DESC,i.product_name ASC,i.product_id ASC NULLS LAST LIMIT $3
      )
      SELECT json_build_object(
        'summary',(SELECT json_build_object('totalRevenue',revenue/100.0,'paidOrders',paid_orders,'customers',customers,'averageOrder',average_order/100.0,'averageUser',average_user/100.0) FROM summary),
        'trend',(SELECT COALESCE(json_agg(json_build_object('date',to_char(d.day,'YYYY-MM-DD'),'revenue',COALESCE(r.revenue,0)/100.0) ORDER BY d.day),'[]'::json) FROM days d LEFT JOIN daily r USING(day)),
        'orderStates',(SELECT json_agg(json_build_object('state',label,'count',count,'percentage',COALESCE(ROUND(count*100.0/NULLIF((SELECT COUNT(*) FROM filtered),0),2),0)) ORDER BY label) FROM states),
        'topProducts',(SELECT COALESCE(json_agg(json_build_object('productId',product_id,'name',product_name,'units',units,'revenue',revenue/100.0) ORDER BY units DESC,revenue DESC,product_name,product_id),'[]'::json) FROM ranking)
      ) AS dashboard`, [start,end,top]);
    return rows[0].dashboard;
  }
}
module.exports = { AnalyticsRepositoryAdapter };
