function m = trimmed_mean(v, k)
    % Internal helper, kept in a private/ subfolder.
    s = sort(v);
    s = s(1 + k:end - k);
    m = mean(s);
end
