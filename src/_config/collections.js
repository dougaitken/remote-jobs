import {
  featuredCompanySlugs,
  regionLabels,
  techLabels
} from '../_data/companyHelpers.js';
import { shuffleArray } from './filters/sort-random.js';

/** Memoized glob results — avoids filtering ~850 items 6 times */
let _companyCache = null;
const getCompanies = collection => {
  if (!_companyCache) {
    _companyCache = collection.getFilteredByGlob('./src/companies/**/*.md');
  }
  return _companyCache;
};

/** All blog posts as a collection. */
export const getAllPosts = collection => {
  return collection.getFilteredByGlob('./src/blog/**/*.md').reverse();
};

/** All company profiles as a collection, sorted alphabetically */
export const getAllCompanies = collection => {
  return [...getCompanies(collection)].sort((a, b) => {
    const nameA = (a.data.title || '').toLowerCase();
    const nameB = (b.data.title || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
};

/** Featured companies - randomly selected from curated list */
export const getFeaturedCompanies = collection => {
  const companies = getCompanies(collection);
  const matched = featuredCompanySlugs
    .map(slug => companies.find(c => c.data.slug === slug || c.fileSlug === slug))
    .filter(Boolean);
  return shuffleArray(matched).slice(0, 8);
};

/** Recently added companies (by addedAt date from frontmatter) */
export const getRecentCompanies = collection => {
  return [...getCompanies(collection)]
    .filter(c => c.data.addedAt)
    .sort((a, b) => b.data.addedAt - a.data.addedAt)
    .slice(0, 12);
};

/** Companies grouped by region */
export const getCompaniesByRegion = collection => {
  const companies = getCompanies(collection);
  const regionGroups = {};

  // Initialize all regions
  Object.keys(regionLabels).forEach(region => {
    regionGroups[region] = [];
  });

  companies.forEach(company => {
    const region = company.data.region || 'other';
    if (!regionGroups[region]) {
      regionGroups[region] = [];
    }
    regionGroups[region].push(company);
  });

  return regionGroups;
};

/** Companies grouped by technology */
export const getCompaniesByTech = collection => {
  const companies = getCompanies(collection);
  const techGroups = {};

  // Initialize all technologies
  Object.keys(techLabels).forEach(tech => {
    techGroups[tech] = [];
  });

  companies.forEach(company => {
    const technologies = company.data.technologies || [];
    technologies.forEach(tech => {
      if (!techGroups[tech]) {
        techGroups[tech] = [];
      }
      techGroups[tech].push(company);
    });
  });

  return techGroups;
};

/** All relevant pages as a collection for sitemap.xml */
export const showInSitemap = collection => {
  return collection.getFilteredByGlob('./src/**/*.{md,njk}');
};

/** All tags from blog posts as a collection - excluding custom collections */
export const tagList = collection => {
  const tagsSet = new Set();
  // Only get tags from blog posts, not from companies or other content
  collection.getFilteredByGlob('./src/blog/**/*.md').forEach(item => {
    if (!item.data.tags || !Array.isArray(item.data.tags)) return;
    item.data.tags
      .filter(tag => typeof tag === 'string' && !['posts', 'docs', 'all'].includes(tag))
      .forEach(tag => tagsSet.add(tag));
  });
  return Array.from(tagsSet).sort();
};
