import * as cheerio from 'cheerio';

export interface ScrapedStats {
  battingAvg?: number;
  strikeRate?: number;
  careerWickets?: number;
  economy?: number;
  profileImageUrl?: string;
  rawHtml?: string;
}

// Resolve chshare.link and other short URLs
async function resolveUrl(url: string): Promise<string> {
  try {
    const resp = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    return resp.url;
  } catch {
    return url;
  }
}

export async function scrapePlayerStats(profileUrl: string): Promise<ScrapedStats> {
  try {
    // Resolve short URLs (chshare.link → cricheroes.com/player-profile/...)
    let resolvedUrl = profileUrl;
    if (!profileUrl.includes('cricheroes.com/player-profile')) {
      resolvedUrl = await resolveUrl(profileUrl);
    }

    const resp = await fetch(resolvedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!resp.ok) return {};

    const html = await resp.text();
    const $ = cheerio.load(html);

    const stats: ScrapedStats = {};

    // CricHeroes profile page stat parsing
    // Stats typically appear in a grid with labels like "Avg", "SR", "Wkts", "Econ"
    $('[class*="stat"], [class*="career"], [class*="batting"], [class*="bowling"]').each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      const value = parseFloat($(el).next().text().trim());

      if (!isNaN(value)) {
        if (text.includes('avg') || text.includes('average')) stats.battingAvg = value;
        if (text.includes('sr') || text.includes('strike')) stats.strikeRate = value;
        if (text.includes('wkt') || text.includes('wicket')) stats.careerWickets = Math.round(value);
        if (text.includes('econ') || text.includes('economy')) stats.economy = value;
      }
    });

    // Fallback: parse JSON-LD structured data if available
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '{}');
        if (json.athlete || json.statisticData) {
          // Parse whatever structured stats are available
          const d = json.athlete || json.statisticData || {};
          if (d.battingAverage) stats.battingAvg = parseFloat(d.battingAverage);
          if (d.strikeRate) stats.strikeRate = parseFloat(d.strikeRate);
          if (d.wickets) stats.careerWickets = parseInt(d.wickets);
          if (d.economy) stats.economy = parseFloat(d.economy);
        }
      } catch {
        // ignore malformed JSON
      }
    });

    // Try generic number extraction near known labels
    const pageText = $('body').text();
    const patterns: Array<{ key: keyof ScrapedStats; patterns: RegExp[] }> = [
      { key: 'battingAvg', patterns: [/bat(?:ting)?\s*avg[:\s]+([0-9.]+)/i, /avg[:\s]+([0-9.]+)/i] },
      { key: 'strikeRate', patterns: [/s\.?r\.?[:\s]+([0-9.]+)/i, /strike\s*rate[:\s]+([0-9.]+)/i] },
      { key: 'careerWickets', patterns: [/wkt?s?[:\s]+([0-9]+)/i, /wickets[:\s]+([0-9]+)/i] },
      { key: 'economy', patterns: [/econ(?:omy)?[:\s]+([0-9.]+)/i] },
    ];

    patterns.forEach(({ key, patterns: regexps }) => {
      if (stats[key] !== undefined) return;
      for (const re of regexps) {
        const m = pageText.match(re);
        if (m) {
          const val = parseFloat(m[1]);
          if (!isNaN(val)) {
            if (key === 'careerWickets') (stats as Record<string, number>)[key] = Math.round(val);
            else (stats as Record<string, number>)[key] = val;
            break;
          }
        }
      }
    });

    // Profile image
    const imgSrc = $('img[class*="profile"], img[class*="avatar"], img[alt*="profile"]').first().attr('src');
    if (imgSrc) stats.profileImageUrl = imgSrc;

    return stats;
  } catch (err) {
    console.error('Scrape error for', profileUrl, err);
    return {};
  }
}
