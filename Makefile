
test:
	./node_modules/.bin/lab

test-cov:
	./node_modules/.bin/lab -t 85 -c

test-cov-html:
	./node_modules/.bin/lab -r html -o ./coverage.html

.PHONY: test test-cov test-cov-html