function m = robust_center(v)
    % Public entry point; delegates to a helper kept in toolbox/private.
    m = trimmed_mean(v, 1);
end
