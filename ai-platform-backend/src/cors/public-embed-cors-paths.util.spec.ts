import {
  isPublicBrowserEmbedCorsPath,
  normalizeRequestPathForCors,
  pathHasApiPrefix,
  PUBLIC_BROAD_CORS_SUBTREE_PREFIXES,
  STRICT_CORS_PATH_PREFIXES,
} from './public-embed-cors-paths.util';

describe('pathHasApiPrefix', () => {
  it('matches exact path', () => {
    expect(pathHasApiPrefix('/api/user', '/api/user')).toBe(true);
  });

  it('matches child paths with slash', () => {
    expect(pathHasApiPrefix('/api/user/login', '/api/user')).toBe(true);
  });

  it('does not match sibling segments (near-miss)', () => {
    expect(pathHasApiPrefix('/api/users', '/api/user')).toBe(false);
    expect(pathHasApiPrefix('/api/userx', '/api/user')).toBe(false);
  });

  it('does not match prefix as substring of a longer first segment', () => {
    expect(pathHasApiPrefix('/api/widget/previewish', '/api/widget/preview')).toBe(false);
  });

  it('matches preview subtree', () => {
    expect(pathHasApiPrefix('/api/widget/preview/init', '/api/widget/preview')).toBe(true);
  });
});

describe('normalizeRequestPathForCors', () => {
  it('strips query and hash', () => {
    expect(normalizeRequestPathForCors('/api/chat/message?x=1#frag')).toBe('/api/chat/message');
  });

  it('collapses trailing slash', () => {
    expect(normalizeRequestPathForCors('/api/widget/init/')).toBe('/api/widget/init');
  });

  it('collapses duplicate slashes (defensive)', () => {
    expect(normalizeRequestPathForCors('//api/widget/init')).toBe('/api/widget/init');
    expect(normalizeRequestPathForCors('/api//chat//message')).toBe('/api/chat/message');
  });
});

describe('STRICT_CORS_PATH_PREFIXES', () => {
  it('does not overlap PUBLIC_BROAD_CORS_SUBTREE_PREFIXES as equal strings', () => {
    const strict = new Set(STRICT_CORS_PATH_PREFIXES);
    for (const pub of PUBLIC_BROAD_CORS_SUBTREE_PREFIXES) {
      expect(strict.has(pub)).toBe(false);
    }
  });
});

describe('PUBLIC_BROAD_CORS_SUBTREE_PREFIXES', () => {
  it('never uses a single /api segment (would widen the entire API)', () => {
    for (const p of PUBLIC_BROAD_CORS_SUBTREE_PREFIXES) {
      expect(p).not.toBe('/api');
      expect(p.startsWith('/api/')).toBe(true);
    }
  });
});

describe('isPublicBrowserEmbedCorsPath', () => {
  describe('public (broad CORS) — representative', () => {
    it('widget runtime init', () => {
      expect(isPublicBrowserEmbedCorsPath('/api/widget/init')).toBe(true);
    });

    it('register website exact', () => {
      expect(isPublicBrowserEmbedCorsPath('/api/widget/register-website')).toBe(true);
    });

    it('chat subtree', () => {
      expect(isPublicBrowserEmbedCorsPath('/api/chat/message')).toBe(true);
      expect(isPublicBrowserEmbedCorsPath('/api/chat/conversations/list')).toBe(true);
    });

    it('public subtree still broad for paths outside strict marketing prefixes', () => {
      expect(isPublicBrowserEmbedCorsPath('/api/public/future-route')).toBe(true);
    });

    it('analytics subtree (anonymous track — not /api/user/analytics)', () => {
      expect(isPublicBrowserEmbedCorsPath('/api/analytics/track')).toBe(true);
    });
  });

  describe('strict — must stay off public CORS', () => {
    it('preview subtree', () => {
      expect(isPublicBrowserEmbedCorsPath('/api/widget/preview/init')).toBe(false);
      expect(isPublicBrowserEmbedCorsPath('/api/widget/preview/chat')).toBe(false);
    });

    it('testing subtree', () => {
      expect(isPublicBrowserEmbedCorsPath('/api/widget/testing/bot')).toBe(false);
    });

    it('user and admin-style routes', () => {
      expect(isPublicBrowserEmbedCorsPath('/api/user/login')).toBe(false);
      expect(isPublicBrowserEmbedCorsPath('/api/user/bots')).toBe(false);
      expect(isPublicBrowserEmbedCorsPath('/api/user/analytics')).toBe(false);
    });

    it('bots controller', () => {
      expect(isPublicBrowserEmbedCorsPath('/api/bots')).toBe(false);
      expect(isPublicBrowserEmbedCorsPath('/api/bots/anything')).toBe(false);
    });

    it('jobs', () => {
      expect(isPublicBrowserEmbedCorsPath('/api/jobs/auto-run')).toBe(false);
    });

    it('reserved admin prefixes (future routes stay strict)', () => {
      expect(isPublicBrowserEmbedCorsPath('/api/admin')).toBe(false);
      expect(isPublicBrowserEmbedCorsPath('/api/admin/users')).toBe(false);
      expect(isPublicBrowserEmbedCorsPath('/api/super-admin')).toBe(false);
      expect(isPublicBrowserEmbedCorsPath('/api/super-admin/tenants')).toBe(false);
    });

    it('health and unknown api paths', () => {
      expect(isPublicBrowserEmbedCorsPath('/health')).toBe(false);
      expect(isPublicBrowserEmbedCorsPath('/api/unknown')).toBe(false);
    });

    it('marketing / anonymous routes — strict CORS (not arbitrary customer origins)', () => {
      expect(isPublicBrowserEmbedCorsPath('/api/public/bots')).toBe(false);
      expect(isPublicBrowserEmbedCorsPath('/api/public/bots/acme-widget')).toBe(false);
      expect(isPublicBrowserEmbedCorsPath('/api/public/landing/bots')).toBe(false);
      expect(isPublicBrowserEmbedCorsPath('/api/public/visitor-quota/summary')).toBe(false);
      expect(isPublicBrowserEmbedCorsPath('/api/public/visitor-bot/summary')).toBe(false);
      expect(isPublicBrowserEmbedCorsPath('/api/trial/bots')).toBe(false);
    });
  });

  describe('edge / near-miss', () => {
    it('does not widen preview via substring', () => {
      expect(isPublicBrowserEmbedCorsPath('/api/widget/previewish')).toBe(false);
    });

    it('unknown widget subpath stays strict', () => {
      expect(isPublicBrowserEmbedCorsPath('/api/widget/future-internal')).toBe(false);
    });

    it('register-website is exact — no prefix widening', () => {
      expect(isPublicBrowserEmbedCorsPath('/api/widget/register-website/batch')).toBe(false);
    });

    it('strict wins over public if both could apply', () => {
      expect(isPublicBrowserEmbedCorsPath('/api/user/seed')).toBe(false);
    });

    it('chat vs chats — segment boundary', () => {
      expect(isPublicBrowserEmbedCorsPath('/api/chat')).toBe(true);
      expect(isPublicBrowserEmbedCorsPath('/api/chats')).toBe(false);
    });

    it('duplicate slashes normalize to same classification as clean path', () => {
      expect(isPublicBrowserEmbedCorsPath('//api/widget/init')).toBe(true);
      expect(isPublicBrowserEmbedCorsPath('/api//widget//init')).toBe(true);
    });
  });
});
