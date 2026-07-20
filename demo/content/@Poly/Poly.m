classdef Poly
    % A class whose methods live in separate files in the @Poly/ folder.
    properties
        coeffs = []
    end
    methods
        function obj = Poly(c)
            if nargin > 0, obj.coeffs = c; end
        end
        y = evalAt(obj, x)   % implemented in @Poly/evalAt.m
    end
end
