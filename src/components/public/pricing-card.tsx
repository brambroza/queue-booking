import { Card, CardContent, Divider, Stack, Typography } from '@mui/material';

type Props = {
  name: string;
  price: string;
  period?: string;
  items: string[];
  highlight?: boolean;
};

export function PricingCard({ name, price, period = '/เดือน', items, highlight }: Props) {
  return (
    <Card sx={{ borderRadius: 3, height: '100%', border: highlight ? '2px solid #12a862' : undefined }}>
      <CardContent>
        <Typography variant="h6" fontWeight={700}>{name}</Typography>
        <Typography variant="h4" fontWeight={800} sx={{ mt: 1 }}>{price}</Typography>
        <Typography variant="caption" color="text.secondary">{period}</Typography>
        <Divider sx={{ my: 1.5 }} />
        <Stack spacing={0.7}>{items.map((i) => <Typography key={i} variant="body2">• {i}</Typography>)}</Stack>
      </CardContent>
    </Card>
  );
}
