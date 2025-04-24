const startsWithIgnoreCase = (str, prefix) => {
    // Add checks for null/undefined inputs for robustness
    if (typeof str !== 'string' || typeof prefix !== 'string') {
        return false;
    }
    return str.toLowerCase().startsWith(prefix.toLowerCase());
};

export { startsWithIgnoreCase };
