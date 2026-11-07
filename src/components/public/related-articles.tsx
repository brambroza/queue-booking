import Link from 'next/link';
import { Box, Card, CardContent, Container, Grid, Stack, Typography } from '@mui/material';
import { blogPosts, type BlogPost } from '@/components/public/blog-content';
import { postsForSolution, relatedPosts, solutionForPost } from '@/lib/seo/related-content';

const cardSx = { height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' } as const;

/**
 * Grid of post cards linking to `/blog/<slug>`.
 * @param props.posts Posts to show.
 */
function PostCards({ posts }: { posts: BlogPost[] }) {
  return (
    <Grid container spacing={1.5}>
      {posts.map((p) => (
        <Grid key={p.slug} size={{ xs: 12, sm: 6, md: posts.length >= 3 ? 4 : 6 }}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">{p.category}</Typography>
              <Typography component={Link} href={`/blog/${p.slug}`} sx={{ display: 'block', mt: 0.5, fontWeight: 700, color: 'text.primary', textDecoration: 'none', '&:hover': { color: '#0a7043', textDecoration: 'underline' } }}>
                {p.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>{p.description}</Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

/**
 * "บทความที่เกี่ยวข้อง" block for a solution page. Renders nothing when no post is about this page.
 * @param props.path Path of the solution page, e.g. `/solutions/clinic-booking-system`.
 */
export function SolutionRelatedArticles({ path }: { path: string }) {
  const posts = postsForSolution(path, blogPosts, 3);
  if (posts.length === 0) return null;
  return (
    <Container maxWidth="lg" sx={{ py: 7 }}>
      <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 2 }}>
        บทความที่เกี่ยวข้อง
      </Typography>
      <PostCards posts={posts} />
    </Container>
  );
}

/**
 * "อ่านต่อ" block under a blog post: the matching solution page plus three related posts.
 * @param props.post Post being read.
 */
export function BlogReadNext({ post }: { post: BlogPost }) {
  const solution = solutionForPost(post);
  const posts = relatedPosts(post, blogPosts, 3);
  return (
    <Box sx={{ mt: 5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: '#F2F8F4', border: '1px solid #DDEBDD' }}>
        <Typography fontWeight={700}>ดูระบบที่ใช้ในบทความนี้:</Typography>
        <Typography component={Link} href={solution.path} sx={{ color: '#0a7043', fontWeight: 700 }}>
          {solution.label}
        </Typography>
      </Stack>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 800, mb: 2 }}>
        บทความที่เกี่ยวข้อง
      </Typography>
      <PostCards posts={posts} />
    </Box>
  );
}
