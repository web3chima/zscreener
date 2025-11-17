-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  conditions JSONB NOT NULL,
  notification_method VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create alert notifications table
CREATE TABLE IF NOT EXISTS alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
  triggered_at TIMESTAMP DEFAULT NOW(),
  notification_data JSONB
);

-- Create indexes for alert queries
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_active ON alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_alert_id ON alert_notifications(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_triggered_at ON alert_notifications(triggered_at);
