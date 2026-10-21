export const copyProspectLocationsToClientSql = `INSERT INTO organization_locations
  (id, entity_type, entity_id, name, address_line, city, region, country, is_primary, source_url)
 SELECT UUID(), 'client', ?, source.name, source.address_line, source.city, source.region,
        source.country, source.is_primary, source.source_url
   FROM organization_locations AS source
   LEFT JOIN organization_locations AS target
     ON target.entity_type = 'client' AND target.entity_id = ?
    AND target.name = source.name
    AND COALESCE(target.address_line, '') = COALESCE(source.address_line, '')
  WHERE source.entity_type = 'prospect' AND source.entity_id = ? AND target.id IS NULL`;
