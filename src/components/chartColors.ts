export const DEFAULT_SECTOR_PALETTE = ['#2563eb', '#059669', '#f59e0b', '#7c3aed', '#ef4444', '#0ea5e9'];

export const buildSectorColorMap = (groups: string[]): Record<string, string> => {
    const uniqueGroups = [...new Set(groups)];
    return uniqueGroups.reduce<Record<string, string>>((map, group, index) => {
        map[group] = DEFAULT_SECTOR_PALETTE[index % DEFAULT_SECTOR_PALETTE.length];
        return map;
    }, {});
};
