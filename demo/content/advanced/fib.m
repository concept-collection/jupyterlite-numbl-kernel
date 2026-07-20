function y = fib(n)
% Recursive Fibonacci. Named functions live in .m files, not in cells.
if n <= 2
    y = 1;
else
    y = fib(n - 1) + fib(n - 2);
end
end
