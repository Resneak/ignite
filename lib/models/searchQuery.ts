export default interface SearchQuery {
    /**
     * keywords to include in the search
     */
    included: string[];

    /**
     * keywords to exclude in the search
     */
    excluded: string[];
}
