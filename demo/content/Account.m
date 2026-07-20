classdef Account < handle
    % A handle class: instances have reference semantics.
    properties
        Balance = 0
    end
    methods
        function obj = Account(initial)
            if nargin > 0
                obj.Balance = initial;
            end
        end
        function deposit(obj, amount)
            obj.Balance = obj.Balance + amount;
        end
        function withdraw(obj, amount)
            if amount > obj.Balance
                error('Account:insufficientFunds', 'Insufficient funds');
            end
            obj.Balance = obj.Balance - amount;
        end
    end
end
