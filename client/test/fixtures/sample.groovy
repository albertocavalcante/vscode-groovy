/**
 * Sample Groovy file for testing
 */
class SampleClass {
    private String name
    private int age

    def getName() {
        return name
    }

    def setName(String name) {
        this.name = name
    }

    def greet() {
        return "Hello, ${name}!"
    }

    static void main(String[] args) {
        def sample = new SampleClass()
        sample.setName('World')
        println sample.greet()
    }
}