package com.demo.bookstore_app.controllers;

import com.demo.bookstore_app.models.Book;
import com.demo.bookstore_app.services.BookService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/book")
public class BookController {

    @Autowired
    private BookService bookService;

    @GetMapping
    public ResponseEntity getAllBooks() {
        try {
            List<Book> books = bookService.getAllBooks();
            return ResponseEntity.ok(books);
        } catch (Exception ex) {
            return new ResponseEntity(ex.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping("/{bookId}")
    public ResponseEntity getBookById(@PathVariable("bookId") Long id) {
        try {
            Book book  = bookService.getBookById(id);
            return ResponseEntity.ok(book);
        } catch (Exception ex) {
            return new ResponseEntity(ex.getMessage(), HttpStatus.NOT_FOUND);
        }
    }

    @DeleteMapping("/{bookId}")
    public ResponseEntity deleteBook(@PathVariable("bookId") Long id) {
        try {
            bookService.deleteBook(id);
            return ResponseEntity.ok("Successfully deleted book!");
        } catch (Exception ex) {
            return new ResponseEntity(ex.getMessage(), HttpStatus.NOT_FOUND);
        }
    }

    @PutMapping("/{bookId}")
    public ResponseEntity updateBook(@PathVariable("bookId") Long id, @RequestBody Book updatedBook) {
        try {
            Book updated = bookService.updateBook(id, updatedBook);
            return ResponseEntity.ok(updated);
        } catch (Exception ex) {
            return new ResponseEntity(ex.getMessage(), HttpStatus.NOT_FOUND);
        }
    }

    @PostMapping
    public ResponseEntity createBook(@RequestBody Book newBook) {
        try {
            Book addedBook = bookService.saveBook(newBook);
            return new ResponseEntity(null, HttpStatus.CREATED);
        } catch (Exception ex) {
            return new ResponseEntity(ex.getMessage(), HttpStatus.NOT_FOUND);
        }
    }

    //SEARCH BOOKS

    @GetMapping("/search")
    public ResponseEntity searchBooks(@RequestParam(required = false) String title,
                                      @RequestParam(required = false) String author,
                                      @RequestParam(required = false) String genre) {
        List<Book> books;

        try{
            if (title != null) {
                books = bookService.searchBooksByTitle(title);
            } else if (author != null) {
                books = bookService.searchBooksByGenre(genre);
            } else if (genre != null) {
                books = bookService.searchBooksByAuthor(author);
            } else {
                books = bookService.getAllBooks();
            }
                return ResponseEntity.ok(books);
            }
        catch (Exception ex) {
            return new ResponseEntity(ex.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
