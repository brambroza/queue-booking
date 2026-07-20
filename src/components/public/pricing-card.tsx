import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

const BRAND = '#12a862';

type Props = {
  name: string;
  price: string;
  period?: string;
  items: string[];
  highlight?: boolean;
};

export function PricingCard({ name, price, period = '/เดือน', items, highlight }: Props) {
  return (
    <Card
      elevation={0}
      sx={{
        position: 'relative',
        height: '100%',
        borderRadius: 4,
        border: '1px solid',
        borderColor: highlight ? BRAND : 'divider',
        bgcolor: 'background.paper',
        transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
        ...(highlight && { boxShadow: '0 12px 40px -12px rgba(18,168,98,.35)' }),
        '&:hover': {
          transform: 'translateY(-4px)',
          borderColor: BRAND,
          boxShadow: '0 16px 44px -16px rgba(18,168,98,.4)',
        },
      }}
    >
      {highlight && (
        <Chip
          label="แนะนำ"
          size="small"
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            fontWeight: 700,
            color: '#fff',
            bgcolor: BRAND,
          }}
        />
      )}

      <CardContent sx={{ p: 3 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
          {name}
        </Typography>

        <Stack direction="row" alignItems="baseline" spacing={0.75} sx={{ mt: 0.5 }}>
          <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1 }}>
            {price}
          </Typography>
          {period && (
            <Typography variant="body2" color="text.secondary">
              {period}
            </Typography>
          )}
        </Stack>

        <Box sx={{ height: '1px', bgcolor: 'divider', my: 2.5 }} />

        <Stack spacing={1.25}>
          {items.map((i) => (
            <Stack key={i} direction="row" spacing={1.25} alignItems="flex-start">
              <CheckRoundedIcon sx={{ fontSize: 18, color: BRAND, mt: '2px' }} />
              <Typography variant="body2" color="text.primary">
                {i}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
