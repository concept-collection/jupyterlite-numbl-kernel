function s = statsutils(x)
% Workspace helper: named functions like this live in a plain .m file next
% to the notebook (numbl's REPL cells can't define named functions
% directly). Edit this file and rerun a cell — numbl picks up the change.
s.mean = mean(x);
s.std = std(x);
s.range = max(x) - min(x);
end
